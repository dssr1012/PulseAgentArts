import { Injectable, Logger } from '@nestjs/common';
import { ProjectionService } from './projection.service';
import { PaymentStrategyService } from './payment-strategy.service';
import { LlmOrchestratorService } from '../llm/llm-orchestrator.service';
import { HuaweiCloudLlmService } from '../llm/huawei-cloud-llm.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { DashboardSpec, Widget } from './ai-dashboard.interface';

export interface CopilotResponse {
  text: string;
  widgets?: Widget[];
}

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private projectionService: ProjectionService,
    private paymentStrategyService: PaymentStrategyService,
    private llmOrchestrator: LlmOrchestratorService,
    private huaweiLlm: HuaweiCloudLlmService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async ask(circleId: string, question: string): Promise<CopilotResponse> {
    if (!this.huaweiLlm.isAvailable()) {
      return { text: 'El asistente financiero no está disponible en este momento.' };
    }

    const data = await this.gatherData(circleId);

    const systemPrompt = `Eres un asesor financiero argentino. El usuario te hace una pregunta sobre sus finanzas.
Responde en español argentino, de forma clara y actionable.

Si la respuesta se beneficia de un gráfico, incluye un widget en la respuesta.
Si no necesita gráfico, solo responde con texto.

Devuelve un JSON con esta estructura:
{
  "text": "tu respuesta en texto plano (puedes usar **negritas** y saltos de línea)",
  "widgets": [Widget]  // opcional, solo si ayuda a visualizar
}

Widget types: "kpi_cards", "area_chart", "bar_chart", "pie_chart", "line_chart", "text_block", "table", "alert"
Cada widget tiene: id, type, title, span ("full"|"half"), y datos específicos según el tipo.
For "table" widgets: rows MUST use the SAME key names as columns. Example: columns=[{key:"detalle",label:"Detalle"},{key:"peso",label:"Peso relativo"}] → rows=[{"detalle":"Gastos fijos","peso":"40%"}]. Never use different keys in rows vs columns.
Colores: emerald=#10b981, red=#ef4444, blue=#3b82f6, yellow=#f59e0b

Devuelve SOLO JSON válido, sin markdown.`;

    const userPrompt = `Pregunta del usuario: "${question}"\n\nDatos financieros:\n${JSON.stringify(data, null, 2)}`;

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

      const parsed = JSON.parse(content) as CopilotResponse;
      return {
        text: parsed.text || 'No pude procesar tu pregunta.',
        widgets: parsed.widgets || [],
      };
    } catch (err) {
      this.logger.error(`Copilot failed: ${err.message}`);
      return { text: 'Lo siento, no pude procesar tu pregunta en este momento. Intenta de nuevo.' };
    }
  }


  async askAsync(circleId: string, question: string): Promise<{ jobId: string }> {
    const jobId = `copilot:${circleId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    await this.redis.setJSON(jobId, { status: 'pending' }, 300);

    // Fire and forget — process in background
    this.processAsync(jobId, circleId, question).catch((err) => {
      this.logger.error(`Async copilot failed: ${err.message}`);
      this.redis.setJSON(jobId, { status: 'error', text: 'Lo siento, ocurrió un error procesando tu pregunta.' }, 300).catch(() => {});
    });

    return { jobId };
  }

  async getResult(jobId: string): Promise<{ status: string; text?: string; widgets?: any[] }> {
    const result = await this.redis.getJSON<any>(jobId);
    if (!result) {
      return { status: 'not_found' };
    }
    return result;
  }

  private async processAsync(jobId: string, circleId: string, question: string): Promise<void> {
    const response = await this.ask(circleId, question);
    await this.redis.setJSON(jobId, { status: 'done', text: response.text, widgets: response.widgets || [] }, 300);
  }

  async askWhatsApp(circleId: string, question: string): Promise<string> {
    if (!this.huaweiLlm.isAvailable()) {
      return 'El asistente no está disponible ahora mismo.';
    }

    const data = await this.gatherData(circleId);

    const systemPrompt = `Eres un asesor financiero argentino respondiendo por WhatsApp.
Responde en español argentino, de forma CLARA y CONCISA (máximo 500 caracteres).
Usa emojis con moderación. No uses markdown ni **negritas** (WhatsApp no lo soporta).
Sé directo y actionable.`;

    const userPrompt = `Pregunta: "${question}"\n\nDatos:\n${JSON.stringify(data, null, 2)}`;

    try {
      const response = await this.llmOrchestrator.execute({
        task: 'general_chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      return response.content;
    } catch (err) {
      this.logger.error(`WhatsApp copilot failed: ${err.message}`);
      return 'No pude procesar tu consulta ahora mismo. Intenta más tarde.';
    }
  }

  isAnalysisRequest(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const keywords = [
      'analisis', 'análisis', 'proyeccion', 'proyección', 'estrategia',
      'inversion', 'inversión', 'inversiones', 'pago', 'pagos',
      'saldo', 'saldos', 'deuda', 'deudas', 'resumen', 'panorama',
      'superavit', 'superávit', 'ahorro', 'ahorros', 'gasto', 'gastos',
      'tarjeta', 'tarjetas', 'flujo', 'caja', 'consejo', 'consejos',
      'que me recomiendas', 'que hago', 'qué hago', 'como pago',
      'cómo pago', 'cuanto', 'cuánto', 'puedo', 'invertir',
      'dashboard', 'panel', 'financiero', 'finanzas',
      'mes', 'meses', 'proximo', 'próximo', 'futuro',
    ];
    return keywords.some((kw) => lower.includes(kw));
  }

  private async gatherData(circleId: string) {
    const projection = await this.projectionService.getProjection(circleId, 12);
    const availableCash = Math.max(projection.monthlySurplus, 0);
    const strategy = await this.paymentStrategyService.getStrategy(circleId, availableCash);

    const cards = await this.prisma.creditCard.findMany({
      where: { groupId: circleId, cardMode: 'credit' },
      select: { bankName: true, lastFourDigits: true, tag: true, creditLimit: true, financingRate: true },
    });

    return {
      projection: {
        monthlySurplus: Math.round(projection.monthlySurplus),
        totalProjectedIncome: Math.round(projection.totalProjectedIncome),
        totalProjectedExpenses: Math.round(projection.totalProjectedExpenses),
        firstSurplusMonth: projection.firstSurplusMonth,
        months: projection.months.map((m) => ({
          label: m.label,
          income: Math.round(m.income),
          expenses: Math.round(m.expenses),
          netCashFlow: Math.round(m.netCashFlow),
        })),
      },
      cards: cards.map((c) => ({
        bankName: c.bankName,
        lastFourDigits: c.lastFourDigits,
        currentBalance: projection.currentMonth.cards.find(
          (cp) => cp.lastFourDigits === c.lastFourDigits,
        )?.currentBalance || 0,
        creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
        financingRate: c.financingRate ? Number(c.financingRate) : null,
      })),
      paymentStrategy: {
        recommendation: strategy.recommendation || 'avalanche',
        scenarios: strategy.scenarios.map((s) => ({
          name: s.name,
          totalInterest: Math.round(s.totalInterest),
          monthsToDebtFree: s.monthsToDebtFree,
        })),
      },
      currentInvestments: ['MERVAL', 'Bonos'],
    };
  }
}
