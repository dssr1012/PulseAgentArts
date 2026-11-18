import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProjectionService } from '../projection/projection.service';
import { PaymentStrategyService } from '../projection/payment-strategy.service';
import { LlmOrchestratorService } from '../llm/llm-orchestrator.service';
import { HuaweiCloudLlmService } from '../llm/huawei-cloud-llm.service';

export interface PlanItemWithDeviation {
  id: string;
  itemType: string;
  cardId: string | null;
  recurringId: string | null;
  label: string;
  plannedAmount: number;
  actualAmount: number | null;
  deviation: number | null;      // planned - actual (positive = underpaid)
  deviationPct: number | null;   // (planned - actual) / planned * 100
  dueDate: string | null;
  dueDay: number | null;
  isFullPayment: boolean;
  isPaid: boolean;
  paidAt: string | null;
  notes: string | null;
}

export interface PaymentPlanWithDeviations {
  id: string;
  month: string;
  scenario: string;
  availableCash: number;
  totalPlanned: number;
  totalPaid: number;
  totalDeviation: number;        // totalPlanned - totalPaid
  paidItemCount: number;
  totalItemCount: number;
  completionPct: number;         // totalPaid / totalPlanned * 100
  status: string;
  notes: string | null;
  llmReasoning: string | null;
  deviationAnalysis: string | null;
  deviationAnalyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PlanItemWithDeviation[];
}

export interface AvailableCashSuggestion {
  income: number;
  fixedExpenses: number;
  bufferPct: number;
  bufferAmount: number;
  suggestedAvailable: number;
  currency: string;
}

export interface LlmPaymentRecommendation {
  payments: Array<{
    cardId: string;
    bankName: string;
    lastFourDigits: string;
    amount: number;
    isFullPayment: boolean;
  }>;
  totalRecommended: number;
  cashRemaining: number;
  reasoning: string;
  summary: string;
}

@Injectable()
export class PaymentPlanService {
  private readonly logger = new Logger(PaymentPlanService.name);

  constructor(
    private prisma: PrismaService,
    private projectionService: ProjectionService,
    private paymentStrategyService: PaymentStrategyService,
    private llmOrchestrator: LlmOrchestratorService,
    private huaweiLlm: HuaweiCloudLlmService,
  ) {}

  /**
   * Generate (or regenerate) the payment plan for the current month.
   * Saves a projection snapshot alongside the plan.
   */
  async generatePlan(
    circleId: string,
    availableCash: number,
    scenarioName?: string,
    saveProjection: boolean = true,
  ): Promise<PaymentPlanWithDeviations> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Get payment strategy from the engine (always needed for card metadata)
    const strategy = await this.paymentStrategyService.getStrategy(circleId, availableCash);

    // Determine if LLM scenario is requested
    const useLlm = scenarioName === 'llm' || scenarioName === 'IA';

    let cardItems: Array<{
      itemType: 'card_payment';
      cardId: string;
      recurringId: null;
      label: string;
      plannedAmount: number;
      dueDay: number | null;
      dueDate: string | null;
      isFullPayment: boolean;
    }>;
    let llmReasoning: string | null = null;
    let scenarioLabel: string;

    if (useLlm) {
      // LLM recommendation path
      const recommendation = await this.getLlmRecommendation(circleId, availableCash);
      llmReasoning = recommendation.reasoning;
      scenarioLabel = 'IA';

      cardItems = recommendation.payments.map((p) => ({
        itemType: 'card_payment' as const,
        cardId: p.cardId,
        recurringId: null,
        label: `${p.bankName} ****${p.lastFourDigits}`,
        plannedAmount: p.amount,
        dueDay: strategy.cards.find((c) => c.cardId === p.cardId)?.dueDay ?? null,
        dueDate: this.computeDueDate(strategy.cards.find((c) => c.cardId === p.cardId)?.dueDay ?? null, now),
        isFullPayment: p.isFullPayment,
      }));
    } else {
      // Mechanical strategy path
      const chosenScenario =
        scenarioName && strategy.scenarios.find((s) => s.name === scenarioName)
          ? strategy.scenarios.find((s) => s.name === scenarioName)!
          : strategy.scenarios.find((s) => s.name === strategy.recommendation) || strategy.scenarios[0];
      scenarioLabel = chosenScenario.name;

      cardItems = chosenScenario.payments.map((p) => ({
        itemType: 'card_payment' as const,
        cardId: p.cardId,
        recurringId: null,
        label: `${p.bankName} ****${p.lastFourDigits}`,
        plannedAmount: p.amount,
        dueDay: strategy.cards.find((c) => c.cardId === p.cardId)?.dueDay ?? null,
        dueDate: this.computeDueDate(strategy.cards.find((c) => c.cardId === p.cardId)?.dueDay ?? null, now),
        isFullPayment: p.isFullPayment,
      }));
    }

    // 2. Get recurring expenses due this month
    const recurringExpenses = await this.getRecurringExpensesForMonth(circleId, now);

    // 3. Build recurring items
    const recurringItems = recurringExpenses.map((r) => ({
      itemType: 'recurring_expense' as const,
      cardId: r.cardId,
      recurringId: r.recurringId,
      label: r.label,
      plannedAmount: r.amount,
      dueDay: r.dueDay,
      dueDate: r.dueDate,
      isFullPayment: false,
    }));

    const allItems = [...cardItems, ...recurringItems];
    const totalPlanned = allItems.reduce((sum, i) => sum + i.plannedAmount, 0);

    // 4. Save projection snapshot
    let projectionData: any = null;
    if (saveProjection) {
      try {
        projectionData = await this.projectionService.getProjection(circleId, 12);
      } catch (err) {
        this.logger.warn(`Could not generate projection snapshot: ${(err as Error).message}`);
      }
    }

    // 5. Upsert plan (delete existing items if regenerating)
    const plan = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentPlan.findUnique({
        where: { groupId_month: { groupId: circleId, month: monthKey } },
      });

      if (existing) {
        await tx.paymentPlanItem.deleteMany({ where: { planId: existing.id } });
      }

      const upserted = await tx.paymentPlan.upsert({
        where: { groupId_month: { groupId: circleId, month: monthKey } },
        create: {
          groupId: circleId,
          month: monthKey,
          scenario: scenarioLabel,
          availableCash,
          totalPlanned,
          totalPaid: 0,
          status: 'active',
          llmReasoning,
        },
        update: {
          scenario: scenarioLabel,
          availableCash,
          totalPlanned,
          totalPaid: 0,
          status: 'active',
          llmReasoning,
          deviationAnalysis: null,
          deviationAnalyzedAt: null,
        },
      });

      for (const item of allItems) {
        await tx.paymentPlanItem.create({
          data: {
            planId: upserted.id,
            itemType: item.itemType,
            cardId: item.cardId,
            recurringId: item.recurringId,
            label: item.label,
            plannedAmount: item.plannedAmount,
            dueDate: item.dueDate,
            dueDay: item.dueDay,
            isFullPayment: item.isFullPayment,
          },
        });
      }

      if (projectionData) {
        await tx.projectionSnapshot.upsert({
          where: { groupId_month: { groupId: circleId, month: monthKey } },
          create: {
            groupId: circleId,
            month: monthKey,
            data: projectionData,
          },
          update: {
            data: projectionData,
          },
        });
      }

      return upserted;
    });

    this.logger.log(`Generated payment plan for circle ${circleId}, month ${monthKey}: ${allItems.length} items, $${totalPlanned} planned`);

    return this.getPlanWithDeviations(plan.id);
  }

  /**
   * Get the current month's plan (or null if none exists).
   */
  async getCurrentPlan(circleId: string): Promise<PaymentPlanWithDeviations | null> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const plan = await this.prisma.paymentPlan.findUnique({
      where: { groupId_month: { groupId: circleId, month: monthKey } },
    });

    if (!plan) return null;
    return this.getPlanWithDeviations(plan.id);
  }

  /**
   * List all plans for a circle (newest first).
   */
  async listPlans(circleId: string): Promise<PaymentPlanWithDeviations[]> {
    const plans = await this.prisma.paymentPlan.findMany({
      where: { groupId: circleId },
      orderBy: { month: 'desc' },
    });

    return Promise.all(plans.map((p) => this.getPlanWithDeviations(p.id)));
  }

  /**
   * Get a single plan with deviations computed.
   */
  async getPlanWithDeviations(planId: string): Promise<PaymentPlanWithDeviations> {
    const plan = await this.prisma.paymentPlan.findUnique({
      where: { id: planId },
      include: { items: { orderBy: { dueDay: 'asc' } } },
    });

    if (!plan) throw new NotFoundException('Payment plan not found');

    const items: PlanItemWithDeviation[] = plan.items.map((item) => {
      const planned = Number(item.plannedAmount);
      const actual = item.actualAmount !== null ? Number(item.actualAmount) : null;
      const deviation = actual !== null ? planned - actual : null;
      const deviationPct = actual !== null && planned > 0
        ? ((planned - actual) / planned) * 100
        : null;

      return {
        id: item.id,
        itemType: item.itemType,
        cardId: item.cardId,
        recurringId: item.recurringId,
        label: item.label,
        plannedAmount: planned,
        actualAmount: actual,
        deviation: deviation !== null ? Math.round(deviation * 100) / 100 : null,
        deviationPct: deviationPct !== null ? Math.round(deviationPct * 100) / 100 : null,
        dueDate: item.dueDate?.toISOString() || null,
        dueDay: item.dueDay,
        isFullPayment: item.isFullPayment,
        isPaid: item.isPaid,
        paidAt: item.paidAt?.toISOString() || null,
        notes: item.notes,
      };
    });

    const totalPlanned = Number(plan.totalPlanned);
    const totalPaid = Number(plan.totalPaid);
    const paidItemCount = items.filter((i) => i.isPaid).length;

    return {
      id: plan.id,
      month: plan.month,
      scenario: plan.scenario,
      availableCash: Number(plan.availableCash),
      totalPlanned,
      totalPaid,
      totalDeviation: Math.round((totalPlanned - totalPaid) * 100) / 100,
      paidItemCount,
      totalItemCount: items.length,
      completionPct: totalPlanned > 0 ? Math.round((totalPaid / totalPlanned) * 10000) / 100 : 0,
      status: plan.status,
      notes: plan.notes,
      llmReasoning: plan.llmReasoning,
      deviationAnalysis: plan.deviationAnalysis,
      deviationAnalyzedAt: plan.deviationAnalyzedAt?.toISOString() || null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      items,
    };
  }

  /**
   * Mark an item as paid (or update the actual amount).
   */
  async markItemPaid(
    planId: string,
    itemId: string,
    actualAmount: number,
    notes?: string,
  ): Promise<PaymentPlanWithDeviations> {
    const item = await this.prisma.paymentPlanItem.findFirst({
      where: { id: itemId, planId },
    });
    if (!item) throw new NotFoundException('Plan item not found');

    await this.prisma.paymentPlanItem.update({
      where: { id: itemId },
      data: {
        actualAmount,
        isPaid: true,
        paidAt: new Date(),
        notes: notes ?? item.notes,
      },
    });

    await this.recomputePlanTotals(planId);

    return this.getPlanWithDeviations(planId);
  }

  /**
   * Update an item (partial — can set actualAmount, isPaid, notes without marking fully paid).
   */
  async updateItem(
    planId: string,
    itemId: string,
    data: { actualAmount?: number; isPaid?: boolean; notes?: string },
  ): Promise<PaymentPlanWithDeviations> {
    const item = await this.prisma.paymentPlanItem.findFirst({
      where: { id: itemId, planId },
    });
    if (!item) throw new NotFoundException('Plan item not found');

    const updateData: any = {};
    if (data.actualAmount !== undefined) {
      updateData.actualAmount = data.actualAmount;
    }
    if (data.isPaid !== undefined) {
      updateData.isPaid = data.isPaid;
      if (data.isPaid && !item.paidAt) {
        updateData.paidAt = new Date();
      }
      if (!data.isPaid) {
        updateData.paidAt = null;
      }
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    await this.prisma.paymentPlanItem.update({
      where: { id: itemId },
      data: updateData,
    });

    await this.recomputePlanTotals(planId);

    return this.getPlanWithDeviations(planId);
  }

  /**
   * Get the saved projection snapshot for a month.
   */
  async getProjectionSnapshot(circleId: string, month: string): Promise<any | null> {
    const snapshot = await this.prisma.projectionSnapshot.findUnique({
      where: { groupId_month: { groupId: circleId, month } },
    });
    return snapshot?.data || null;
  }

  /**
   * Archive a plan (without deleting).
   */
  async archivePlan(planId: string): Promise<PaymentPlanWithDeviations> {
    await this.prisma.paymentPlan.update({
      where: { id: planId },
      data: { status: 'archived' },
    });
    return this.getPlanWithDeviations(planId);
  }

  /**
   * Suggest available cash for card payments: income - fixed expenses - 5% buffer.
   */
  async getAvailableCashSuggestion(circleId: string): Promise<AvailableCashSuggestion> {
    const now = new Date();

    const recurring = await this.prisma.recurringTransaction.findMany({
      where: { groupId: circleId, isActive: true },
      select: { amount: true, type: true, frequency: true, nextExecutionDate: true, lastExecutionDate: true, startDate: true, interval: true, dayOfMonth: true },
    });

    let income = 0;
    let fixedExpenses = 0;

    for (const rec of recurring) {
      if (!this.recurringFallsInMonth(rec, now)) continue;
      const amount = Number(rec.amount);
      if (rec.type === 'income') {
        income += amount;
      } else {
        fixedExpenses += amount;
      }
    }

    const bufferPct = 5;
    const bufferAmount = Math.round(income * (bufferPct / 100) * 100) / 100;
    const suggestedAvailable = Math.round((income - fixedExpenses - bufferAmount) * 100) / 100;

    return {
      income: Math.round(income * 100) / 100,
      fixedExpenses: Math.round(fixedExpenses * 100) / 100,
      bufferPct,
      bufferAmount,
      suggestedAvailable,
      currency: 'ARS',
    };
  }

  /**
   * Get LLM payment recommendation: how to split available cash across cards + reasoning.
   */
  async getLlmRecommendation(circleId: string, availableCash: number): Promise<LlmPaymentRecommendation> {
    const strategy = await this.paymentStrategyService.getStrategy(circleId, availableCash);

    if (!this.huaweiLlm.isAvailable() || strategy.cards.length === 0) {
      // Fallback: use the recommended mechanical strategy
      const chosen = strategy.scenarios.find((s) => s.name === strategy.recommendation) || strategy.scenarios[0];
      return {
        payments: chosen.payments.map((p) => ({
          cardId: p.cardId,
          bankName: p.bankName,
          lastFourDigits: p.lastFourDigits,
          amount: p.amount,
          isFullPayment: p.isFullPayment,
        })),
        totalRecommended: chosen.totalPaid,
        cashRemaining: chosen.cashRemaining,
        reasoning: strategy.reasoning,
        summary: `Estrategia ${chosen.name} (fallback — IA no disponible)`,
      };
    }

    const cardData = strategy.cards.map((c) => ({
      cardId: c.cardId,
      bank: c.bankName,
      lastFour: c.lastFourDigits,
      tag: c.tag,
      balance: c.balance,
      financingRate: c.financingRate,
      minPayment: c.minPayment,
      dueDay: c.dueDay,
    }));

    const systemPrompt = `You are an expert financial advisor for an Argentine personal finance app.
The user has ${availableCash} ARS available to pay credit cards this month.
Analyze the cards and recommend how to split the available cash across them.

Return ONLY valid JSON with this EXACT structure:
{
  "payments": [
    { "cardId": "string", "amount": number, "isFullPayment": boolean }
  ],
  "totalRecommended": number,
  "cashRemaining": number,
  "summary": "string — one sentence summary in Spanish",
  "reasoning": "string — 2-4 paragraphs in Spanish explaining WHY this split, considering interest rates, balances, and whether to pay in full or minimum"
}

Rules:
- Prioritize cards with highest financing rate (CFT) to minimize interest costs
- If available cash covers all balances, pay everything (isFullPayment: true)
- If not enough cash, pay at least the minimum on each card, then allocate remaining to highest-rate card
- amount must be a positive number (or 0 if no payment recommended for that card)
- totalRecommended = sum of all payments
- cashRemaining = availableCash - totalRecommended (must be >= 0)
- All text in Argentine Spanish
- Do NOT include markdown, only valid JSON`;

    const userPrompt = `Available cash: ${availableCash} ARS\n\nCards:\n${JSON.stringify(cardData, null, 2)}`;

    try {
      const response = await this.llmOrchestrator.execute({
        task: 'payment_recommendation',
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

      const parsed = JSON.parse(content);

      // Enrich payments with bank info from strategy
      const payments = (parsed.payments || []).map((p: any) => {
        const card = strategy.cards.find((c) => c.cardId === p.cardId);
        return {
          cardId: p.cardId,
          bankName: card?.bankName || 'Unknown',
          lastFourDigits: card?.lastFourDigits || '****',
          amount: Math.round(Number(p.amount) * 100) / 100,
          isFullPayment: Boolean(p.isFullPayment),
        };
      });

      this.logger.log({ event: 'llm_payment_recommendation', cards: payments.length, tokens: response.tokensUsed });

      return {
        payments,
        totalRecommended: Math.round(Number(parsed.totalRecommended || 0) * 100) / 100,
        cashRemaining: Math.round(Number(parsed.cashRemaining || 0) * 100) / 100,
        reasoning: parsed.reasoning || '',
        summary: parsed.summary || '',
      };
    } catch (err) {
      this.logger.error(`LLM payment recommendation failed: ${(err as Error).message}`);
      // Fallback to mechanical strategy
      const chosen = strategy.scenarios.find((s) => s.name === strategy.recommendation) || strategy.scenarios[0];
      return {
        payments: chosen.payments.map((p) => ({
          cardId: p.cardId,
          bankName: p.bankName,
          lastFourDigits: p.lastFourDigits,
          amount: p.amount,
          isFullPayment: p.isFullPayment,
        })),
        totalRecommended: chosen.totalPaid,
        cashRemaining: chosen.cashRemaining,
        reasoning: `Fallback: ${strategy.reasoning}`,
        summary: `Estrategia ${chosen.name} (fallback — error de IA)`,
      };
    }
  }

  /**
   * Analyze plan deviations using LLM and cache the result on the plan.
   */
  async analyzeDeviation(planId: string): Promise<{ analysis: string; analyzedAt: string }> {
    const plan = await this.getPlanWithDeviations(planId);

    if (plan.totalPaid === 0) {
      throw new BadRequestException('No items have been marked as paid yet. Mark items as paid first, then analyze deviations.');
    }

    // If already analyzed and plan hasn't changed, return cached
    if (plan.deviationAnalysis && plan.deviationAnalyzedAt) {
      const planUpdatedAt = new Date(plan.updatedAt).getTime();
      const analyzedAt = new Date(plan.deviationAnalyzedAt).getTime();
      if (analyzedAt >= planUpdatedAt) {
        return { analysis: plan.deviationAnalysis, analyzedAt: plan.deviationAnalyzedAt };
      }
    }

    const itemsData = plan.items.map((i) => ({
      label: i.label,
      type: i.itemType,
      planned: i.plannedAmount,
      actual: i.actualAmount,
      deviation: i.deviation,
      deviationPct: i.deviationPct,
      isPaid: i.isPaid,
      notes: i.notes,
    }));

    const summary = {
      month: plan.month,
      scenario: plan.scenario,
      availableCash: plan.availableCash,
      totalPlanned: plan.totalPlanned,
      totalPaid: plan.totalPaid,
      totalDeviation: plan.totalDeviation,
      completionPct: plan.completionPct,
      items: itemsData,
    };

    if (!this.huaweiLlm.isAvailable()) {
      const fallback = this.buildFallbackDeviationAnalysis(summary);
      await this.storeDeviationAnalysis(planId, fallback);
      return { analysis: fallback, analyzedAt: new Date().toISOString() };
    }

    const systemPrompt = `You are an expert financial advisor for an Argentine personal finance app.
The user had a monthly payment plan and has been marking items as paid throughout the month.
Analyze the deviations between planned and actual payments and explain WHY they happened.

Return ONLY a text response (no JSON, no markdown) in Argentine Spanish with:
1. A summary of the overall deviation
2. Item-by-item analysis of significant deviations (skip items with 0 deviation)
3. Possible reasons for each deviation (unexpected expenses, overpayment, rounding, etc.)
4. A recommendation for next month's plan based on what you learned

Keep it concise and actionable (3-5 paragraphs).`;

    const userPrompt = `Payment plan deviation data:\n${JSON.stringify(summary, null, 2)}`;

    try {
      const response = await this.llmOrchestrator.execute({
        task: 'deviation_analysis',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const analysis = response.content.trim();
      await this.storeDeviationAnalysis(planId, analysis);

      this.logger.log({ event: 'llm_deviation_analysis', planId, tokens: response.tokensUsed });

      return { analysis, analyzedAt: new Date().toISOString() };
    } catch (err) {
      this.logger.error(`LLM deviation analysis failed: ${(err as Error).message}`);
      const fallback = this.buildFallbackDeviationAnalysis(summary);
      await this.storeDeviationAnalysis(planId, fallback);
      return { analysis: fallback, analyzedAt: new Date().toISOString() };
    }
  }

  private async storeDeviationAnalysis(planId: string, analysis: string): Promise<void> {
    await this.prisma.paymentPlan.update({
      where: { id: planId },
      data: {
        deviationAnalysis: analysis,
        deviationAnalyzedAt: new Date(),
      },
    });
  }

  private buildFallbackDeviationAnalysis(summary: any): string {
    const deviatingItems = (summary.items || []).filter((i: any) => i.deviation !== null && i.deviation !== 0);
    const lines: string[] = [
      `Análisis de desvíos para ${summary.month}:`,
      ``,
      `Desvío total: $${summary.totalDeviation} ARS (planificado: $${summary.totalPlanned}, pagado: $${summary.totalPaid}).`,
      `Completado: ${summary.completionPct}%.`,
      ``,
    ];
    if (deviatingItems.length === 0) {
      lines.push('No hay desvíos significativos. Pagaste exactamente lo planificado.');
    } else {
      lines.push('Items con desvío:');
      for (const item of deviatingItems) {
        const direction = item.deviation > 0 ? 'menos' : 'más';
        lines.push(`- ${item.label}: planificado $${item.planned}, pagado $${item.actual} (pagaste ${direction} de lo planificado).`);
      }
    }
    return lines.join('\n');
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async recomputePlanTotals(planId: string): Promise<void> {
    const items = await this.prisma.paymentPlanItem.findMany({
      where: { planId },
      select: { actualAmount: true, isPaid: true },
    });

    const totalPaid = items.reduce((sum, i) => sum + (i.isPaid && i.actualAmount ? Number(i.actualAmount) : 0), 0);
    const allPaid = items.length > 0 && items.every((i) => i.isPaid);

    await this.prisma.paymentPlan.update({
      where: { id: planId },
      data: {
        totalPaid,
        status: allPaid ? 'completed' : 'active',
      },
    });
  }

  private async getRecurringExpensesForMonth(
    circleId: string,
    monthDate: Date,
  ): Promise<Array<{
    recurringId: string;
    cardId: string | null;
    label: string;
    amount: number;
    dueDay: number | null;
    dueDate: string | null;
  }>> {
    const recurring = await this.prisma.recurringTransaction.findMany({
      where: {
        groupId: circleId,
        isActive: true,
        type: 'expense',
      },
      include: { card: true },
    });

    const result: any[] = [];
    for (const rec of recurring) {
      if (!this.recurringFallsInMonth(rec, monthDate)) continue;

      const label = rec.description || rec.merchantName || 'Recurring expense';
      const dueDay = rec.dayOfMonth || null;
      const dueDate = this.computeDueDate(dueDay, monthDate);

      result.push({
        recurringId: rec.id,
        cardId: rec.cardId,
        label: rec.card ? `${label} (${rec.card.bankName} ****${rec.card.lastFourDigits})` : label,
        amount: Number(rec.amount),
        dueDay,
        dueDate,
      });
    }

    return result;
  }

  private computeDueDate(dueDay: number | null, monthDate: Date): string | null {
    if (!dueDay) return null;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(dueDay, lastDayOfMonth);
    return new Date(year, month, day).toISOString();
  }

  private recurringFallsInMonth(recurring: any, monthDate: Date): boolean {
    const refDate = recurring.nextExecutionDate || recurring.lastExecutionDate || recurring.startDate;
    if (!refDate) return false;
    const ref = new Date(refDate);

    if (recurring.frequency === 'monthly') {
      return true;
    }

    if (recurring.frequency === 'weekly') {
      const next = new Date(ref);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      while (next <= monthEnd) {
        if (next.getFullYear() === monthDate.getFullYear() && next.getMonth() === monthDate.getMonth()) {
          return true;
        }
        next.setDate(next.getDate() + 7 * (recurring.interval || 1));
      }
      return false;
    }

    if (recurring.frequency === 'yearly') {
      return ref.getFullYear() === monthDate.getFullYear() && ref.getMonth() === monthDate.getMonth();
    }

    return false;
  }
}
