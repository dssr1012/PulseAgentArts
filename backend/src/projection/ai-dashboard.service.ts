import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { PrismaService } from '../common/prisma.service';
import { ProjectionService } from './projection.service';
import { PaymentStrategyService } from './payment-strategy.service';
import { LlmOrchestratorService } from '../llm/llm-orchestrator.service';
import { HuaweiCloudLlmService } from '../llm/huawei-cloud-llm.service';
import { DashboardSpec, CompactFinancialData } from './ai-dashboard.interface';

const CACHE_KEY = (circleId: string) => `ai-dashboard:${circleId}`;
const CACHE_TTL = 2592000; // 30 days — regenerate monthly, not on every page load

@Injectable()
export class AiDashboardService {
  private readonly logger = new Logger(AiDashboardService.name);

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
    private projectionService: ProjectionService,
    private paymentStrategyService: PaymentStrategyService,
    private llmOrchestrator: LlmOrchestratorService,
    private huaweiLlm: HuaweiCloudLlmService,
  ) {}

  async getDashboard(circleId: string, refresh = false): Promise<DashboardSpec> {
    if (!refresh) {
      const cached = await this.redis.getJSON<DashboardSpec>(CACHE_KEY(circleId));
      if (cached) {
        this.logger.log({ event: 'ai_dashboard_cache_hit', circleId });
        return cached;
      }
    }

    const financialData = await this.gatherFinancialData(circleId);
    const spec = await this.generateDashboardSpec(financialData);
    await this.redis.setJSON(CACHE_KEY(circleId), spec, CACHE_TTL);
    return spec;
  }

  async invalidateCache(circleId: string): Promise<void> {
    await this.redis.del(CACHE_KEY(circleId));
  }

  private async gatherFinancialData(circleId: string): Promise<CompactFinancialData> {
    const projection = await this.projectionService.getProjection(circleId, 12);
    const availableCash = Math.max(projection.monthlySurplus, 0);
    const strategy = await this.paymentStrategyService.getStrategy(circleId, availableCash);

    const cards = await this.prisma.creditCard.findMany({
      where: { groupId: circleId, cardMode: 'credit' },
      select: {
        id: true,
        bankName: true,
        lastFourDigits: true,
        tag: true,
        creditLimit: true,
        financingRate: true,
      },
    });

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentTx = await this.prisma.transaction.findMany({
      where: {
        groupId: circleId,
        confirmationStatus: 'confirmed',
        transactionDate: { gte: threeMonthsAgo },
      },
      select: { amount: true, type: true, currency: true },
    });

    const totalIncome = recentTx
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = recentTx
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const projectionMonths = projection.months.map((m) => ({
      label: m.label,
      income: Math.round(m.income),
      expenses: Math.round(m.expenses),
      cardPayments: Math.round(m.cardPayments),
      netCashFlow: Math.round(m.netCashFlow),
      cumulativeBalance: Math.round(m.cumulativeBalance),
    }));

    const cardSummaries = cards.map((c) => {
      const cardProjection = projection.currentMonth.cards.find(
        (cp) => cp.cardId === c.id || cp.lastFourDigits === c.lastFourDigits,
      );
      return {
        bankName: c.bankName,
        lastFourDigits: c.lastFourDigits,
        tag: c.tag,
        creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
        financingRate: c.financingRate ? Number(c.financingRate) : null,
        currentBalance: cardProjection ? Math.round(cardProjection.currentBalance) : 0,
      };
    });

    return {
      balance: {
        totalIncome: Math.round(totalIncome),
        totalExpenses: Math.round(totalExpenses),
        netBalance: Math.round(totalIncome - totalExpenses),
        currency: 'ARS',
      },
      projection: {
        months: projectionMonths,
        totalProjectedIncome: Math.round(projection.totalProjectedIncome),
        totalProjectedExpenses: Math.round(projection.totalProjectedExpenses),
        totalProjectedCardPayments: Math.round(projection.totalProjectedCardPayments),
        firstSurplusMonth: projection.firstSurplusMonth,
        monthlySurplus: Math.round(projection.monthlySurplus),
      },
      cards: cardSummaries,
      paymentStrategy: {
        recommendation: strategy.recommendation || 'avalanche',
        scenarios: strategy.scenarios.map((s) => ({
          name: s.name,
          totalInterest: Math.round(s.totalInterest),
          monthsToDebtFree: s.monthsToDebtFree,
        })),
      },
      investments: {
        monthlySurplus: Math.round(projection.monthlySurplus),
        currentInvestments: ['MERVAL', 'Bonos'],
      },
    };
  }

  private async generateDashboardSpec(data: CompactFinancialData): Promise<DashboardSpec> {
    if (!this.huaweiLlm.isAvailable()) {
      return this.fallbackSpec(data);
    }

    const systemPrompt = `You are an expert financial advisor and dashboard designer for an Argentine personal finance app.
Analyze the user's financial data and design a personalized dashboard that highlights the most important insights.

Return a JSON object with this EXACT structure:
{
  "title": "string — dashboard title in Spanish",
  "subtitle": "string — subtitle with date range in Spanish",
  "insights": ["string", ...] — 2-4 key insights in Spanish,
  "widgets": [Widget, ...] — 3-6 widgets
}

Widget types and their required fields:
1. "kpi_cards" — span, cards: [{label, value, currency, icon, tone}]
2. "area_chart" — span, title, x_key, series: [{name, data_key, color}], data: [{key: value}]
3. "bar_chart" — span, title, x_key, series, data
4. "pie_chart" — span, title, x_key, series, data
5. "line_chart" — span, title, x_key, series, data
6. "text_block" — span, title, content, tone
7. "table" — span, title, columns: [{key, label, align}], rows: [{key: value}]
8. "alert" — span, title, content, tone

Rules:
- Show 3-6 widgets, prioritizing the most relevant insights
- If no card debt (all balances are 0) → skip payment strategy charts, emphasize investments and surplus
- If high debt → emphasize payment strategy comparison, show interest costs
- If high surplus (>0) → show investment suggestions prominently
- Use the user's ACTUAL data to populate chart data arrays
- All text in Spanish (Argentine Spanish preferred)
- Currency values as numbers (no $ sign, no formatting)
- Colors: emerald=#10b981 (positive/income), red=#ef4444 (negative/expenses), blue=#3b82f6 (neutral/balance), yellow=#f59e0b (warning)
- span: "full" for wide widgets, "half" for side-by-side, "third" for 3-column
- icon names (for kpi_cards): "trending-up", "trending-down", "credit-card", "piggy-bank", "wallet", "target", "alert-triangle"
- tone values: "emerald", "red", "blue", "yellow", "info", "warning", "danger"

Return ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `Financial data:\n${JSON.stringify(data, null, 2)}`;

    try {
      const response = await this.llmOrchestrator.execute({
        task: 'dashboard_design',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: 'json',
      });

      let content = response.content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const spec = JSON.parse(content) as DashboardSpec;
      this.logger.log({
        event: 'ai_dashboard_generated',
        widgets: spec.widgets?.length || 0,
        tokens: response.tokensUsed,
      });
      return spec;
    } catch (err) {
      this.logger.error(`AI dashboard generation failed: ${err.message}`);
      return this.fallbackSpec(data);
    }
  }

  private fallbackSpec(data: CompactFinancialData): DashboardSpec {
    const widgets: DashboardSpec['widgets'] = [
      {
        id: 'kpi_summary',
        type: 'kpi_cards',
        span: 'full',
        cards: [
          { label: 'Superávit Mensual', value: data.projection.monthlySurplus, currency: 'ARS', icon: 'trending-up', tone: data.projection.monthlySurplus >= 0 ? 'emerald' : 'red' },
          { label: 'Ingreso Proyectado', value: data.projection.totalProjectedIncome, currency: 'ARS', icon: 'wallet', tone: 'blue' },
          { label: 'Gastos Proyectados', value: data.projection.totalProjectedExpenses, currency: 'ARS', icon: 'trending-down', tone: 'red' },
        ],
      },
      {
        id: 'cash_flow',
        type: 'area_chart',
        title: 'Flujo de Caja Proyectado',
        span: 'full',
        x_key: 'label',
        series: [
          { name: 'Ingresos', data_key: 'income', color: '#10b981' },
          { name: 'Gastos', data_key: 'expenses', color: '#ef4444' },
          { name: 'Balance', data_key: 'netCashFlow', color: '#3b82f6' },
        ],
        data: data.projection.months,
      },
    ];

    return {
      title: 'Tu Panorama Financiero',
      subtitle: 'Proyección 12 meses',
      insights: [
        `Superávit mensual: $${data.projection.monthlySurplus.toLocaleString('es-AR')} ARS`,
        data.projection.firstSurplusMonth ? `Primer mes con superávit: ${data.projection.firstSurplusMonth}` : 'Generando superávit desde ahora',
      ],
      widgets,
    };
  }
}
