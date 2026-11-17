import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProjectionService, CardProjection } from './projection.service';

export interface PaymentScenario {
  name: string;
  description: string;
  payments: Array<{
    cardId: string;
    bankName: string;
    lastFourDigits: string;
    amount: number;
    isFullPayment: boolean;
  }>;
  totalPaid: number;
  totalInterest: number;        // Interest over 12 months
  monthsToDebtFree: number;
  cashRemaining: number;
}

export interface PaymentStrategyResult {
  availableCash: number;
  cards: Array<{
    cardId: string;
    bankName: string;
    lastFourDigits: string;
    tag: string | null;
    balance: number;
    financingRate: number | null;
    minPayment: number;
    dueDay: number | null;
  }>;
  scenarios: PaymentScenario[];
  recommendation: string;
  reasoning: string;
}

@Injectable()
export class PaymentStrategyService {
  private readonly logger = new Logger(PaymentStrategyService.name);

  constructor(
    private prisma: PrismaService,
    private projectionService: ProjectionService,
  ) {}

  async getStrategy(
    circleId: string,
    availableCash: number,
  ): Promise<PaymentStrategyResult> {
    // Get current month projection to get card balances
    const projection = await this.projectionService.getProjection(circleId, 1);
    const currentCards = projection.currentMonth.cards;

    // Filter cards that have a balance
    const cardsWithBalance = currentCards.filter((c) => c.projectedBalance > 0);

    const cards = cardsWithBalance.map((c) => ({
      cardId: c.cardId,
      bankName: c.bankName,
      lastFourDigits: c.lastFourDigits,
      tag: c.tag,
      balance: c.projectedBalance,
      financingRate: c.financingRate,
      minPayment: c.minPayment,
      dueDay: c.dueDay,
    }));

    // Generate scenarios
    const scenarios: PaymentScenario[] = [];

    // Scenario 1: Avalanche (highest rate first)
    scenarios.push(this.calculateAvalanche(cards, availableCash));

    // Scenario 2: Snowball (lowest balance first)
    scenarios.push(this.calculateSnowball(cards, availableCash));

    // Scenario 3: Proportional
    scenarios.push(this.calculateProportional(cards, availableCash));

    // Scenario 4: Minimum payments only
    scenarios.push(this.calculateMinimumOnly(cards, availableCash));

    // Find best scenario (lowest total interest)
    const best = scenarios.reduce((min, s) => s.totalInterest < min.totalInterest ? s : min);

    // Generate reasoning
    const reasoning = this.generateReasoning(best, scenarios, cards);

    return {
      availableCash,
      cards,
      scenarios,
      recommendation: best.name,
      reasoning,
    };
  }

  private calculateAvalanche(
    cards: PaymentStrategyResult['cards'],
    cash: number,
  ): PaymentScenario {
    // Sort by financing rate descending (highest rate first)
    const sorted = [...cards].sort((a, b) => {
      const rateA = a.financingRate || 0;
      const rateB = b.financingRate || 0;
      return rateB - rateA;
    });

    return this.distributePayments(sorted, cash, 'Avalanche', 'Pay highest-interest cards first to minimize total interest');
  }

  private calculateSnowball(
    cards: PaymentStrategyResult['cards'],
    cash: number,
  ): PaymentScenario {
    // Sort by balance ascending (lowest balance first)
    const sorted = [...cards].sort((a, b) => a.balance - b.balance);

    return this.distributePayments(sorted, cash, 'Snowball', 'Pay lowest-balance cards first for psychological wins and momentum');
  }

  private calculateProportional(
    cards: PaymentStrategyResult['cards'],
    cash: number,
  ): PaymentScenario {
    const totalBalance = cards.reduce((s, c) => s + c.balance, 0);
    if (totalBalance === 0) {
      return this.emptyScenario('Proportional', 'Pay each card proportionally to its balance');
    }

    let remainingCash = cash;
    const payments: PaymentScenario['payments'] = [];
    let totalPaid = 0;

    for (const card of cards) {
      // Pay at least minimum, then proportional share
      const proportionalShare = (card.balance / totalBalance) * cash;
      const payment = Math.min(Math.max(proportionalShare, card.minPayment), card.balance, remainingCash);
      if (payment > 0) {
        payments.push({
          cardId: card.cardId,
          bankName: card.bankName,
          lastFourDigits: card.lastFourDigits,
          amount: Math.round(payment * 100) / 100,
          isFullPayment: payment >= card.balance - 0.01,
        });
        totalPaid += payment;
        remainingCash -= payment;
      }
    }

    const { totalInterest, monthsToDebtFree } = this.calculateInterestAndMonths(cards, payments);

    return {
      name: 'Proportional',
      description: 'Pay each card proportionally to its balance',
      payments,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      monthsToDebtFree,
      cashRemaining: Math.round(remainingCash * 100) / 100,
    };
  }

  private calculateMinimumOnly(
    cards: PaymentStrategyResult['cards'],
    cash: number,
  ): PaymentScenario {
    let remainingCash = cash;
    const payments: PaymentScenario['payments'] = [];
    let totalPaid = 0;

    for (const card of cards) {
      const payment = Math.min(card.minPayment, remainingCash);
      if (payment > 0) {
        payments.push({
          cardId: card.cardId,
          bankName: card.bankName,
          lastFourDigits: card.lastFourDigits,
          amount: Math.round(payment * 100) / 100,
          isFullPayment: false,
        });
        totalPaid += payment;
        remainingCash -= payment;
      }
    }

    const { totalInterest, monthsToDebtFree } = this.calculateInterestAndMonths(cards, payments);

    return {
      name: 'Minimum Only',
      description: 'Pay only minimum payments (highest interest cost, not recommended)',
      payments,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      monthsToDebtFree,
      cashRemaining: Math.round(remainingCash * 100) / 100,
    };
  }

  private distributePayments(
    sortedCards: PaymentStrategyResult['cards'],
    cash: number,
    name: string,
    description: string,
  ): PaymentScenario {
    let remainingCash = cash;
    const payments: PaymentScenario['payments'] = [];
    let totalPaid = 0;

    // First pass: pay minimum on all cards
    for (const card of sortedCards) {
      const minPay = Math.min(card.minPayment, remainingCash);
      if (minPay > 0) {
        payments.push({
          cardId: card.cardId,
          bankName: card.bankName,
          lastFourDigits: card.lastFourDigits,
          amount: minPay,
          isFullPayment: minPay >= card.balance - 0.01,
        });
        totalPaid += minPay;
        remainingCash -= minPay;
      }
    }

    // Second pass: pay down cards in order with remaining cash
    for (const card of sortedCards) {
      if (remainingCash <= 0) break;

      const existingPayment = payments.find((p) => p.cardId === card.cardId);
      const alreadyPaid = existingPayment?.amount || 0;
      const remainingBalance = card.balance - alreadyPaid;

      if (remainingBalance <= 0) continue;

      const additionalPayment = Math.min(remainingBalance, remainingCash);
      if (existingPayment) {
        existingPayment.amount = Math.round((alreadyPaid + additionalPayment) * 100) / 100;
        existingPayment.isFullPayment = existingPayment.amount >= card.balance - 0.01;
      } else {
        payments.push({
          cardId: card.cardId,
          bankName: card.bankName,
          lastFourDigits: card.lastFourDigits,
          amount: Math.round(additionalPayment * 100) / 100,
          isFullPayment: additionalPayment >= card.balance - 0.01,
        });
      }
      totalPaid += additionalPayment;
      remainingCash -= additionalPayment;
    }

    const { totalInterest, monthsToDebtFree } = this.calculateInterestAndMonths(sortedCards, payments);

    return {
      name,
      description,
      payments,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      monthsToDebtFree,
      cashRemaining: Math.round(remainingCash * 100) / 100,
    };
  }

  /**
   * Calculate total interest over 12 months and months to debt-free
   * using the remaining balance after the proposed payment.
   */
  private calculateInterestAndMonths(
    cards: PaymentStrategyResult['cards'],
    payments: PaymentScenario['payments'],
  ): { totalInterest: number; monthsToDebtFree: number } {
    let totalInterest = 0;
    let maxMonths = 0;

    for (const card of cards) {
      const payment = payments.find((p) => p.cardId === card.cardId);
      const paidAmount = payment?.amount || 0;
      let remainingBalance = Math.max(0, card.balance - paidAmount);

      const monthlyRate = card.financingRate ? card.financingRate / 100 / 12 : 0;
      const minPayment = card.minPayment;

      let cardInterest = 0;
      let months = 0;

      // Simulate month by month
      while (remainingBalance > 0.01 && months < 120) {
        // Interest accrues on remaining balance
        const monthlyInterest = remainingBalance * monthlyRate;
        cardInterest += monthlyInterest;

        // Pay minimum payment
        const paymentAmount = Math.min(minPayment, remainingBalance + monthlyInterest);
        remainingBalance = remainingBalance + monthlyInterest - paymentAmount;
        months++;
      }

      totalInterest += cardInterest;
      maxMonths = Math.max(maxMonths, months);
    }

    return { totalInterest, monthsToDebtFree: maxMonths };
  }

  private generateReasoning(
    best: PaymentScenario,
    all: PaymentScenario[],
    cards: PaymentStrategyResult['cards'],
  ): string {
    const worst = all.reduce((max, s) => s.totalInterest > max.totalInterest ? s : max);
    const savings = worst.totalInterest - best.totalInterest;

    const fullPayCards = best.payments.filter((p) => p.isFullPayment);
    const partialPayCards = best.payments.filter((p) => !p.isFullPayment);

    let reasoning = `The "${best.name}" strategy minimizes total interest ($${best.totalInterest.toFixed(2)} vs. worst case $${worst.totalInterest.toFixed(2)}, saving $${savings.toFixed(2)}). `;

    if (fullPayCards.length > 0) {
      reasoning += `Pay in full: ${fullPayCards.map((c) => c.bankName).join(', ')}. `;
    }
    if (partialPayCards.length > 0) {
      reasoning += `Partial payment: ${partialPayCards.map((c) => `${c.bankName} ($${c.amount.toFixed(2)})`).join(', ')}. `;
    }

    if (best.monthsToDebtFree < 120) {
      reasoning += `Debt-free in ~${best.monthsToDebtFree} months. `;
    } else {
      reasoning += `At this rate, debt won't be fully paid within 10 years — consider increasing payments. `;
    }

    if (best.cashRemaining > 0) {
      reasoning += `$${best.cashRemaining.toFixed(2)} remaining after payments — consider saving or investing.`;
    }

    return reasoning;
  }

  private emptyScenario(name: string, description: string): PaymentScenario {
    return {
      name,
      description,
      payments: [],
      totalPaid: 0,
      totalInterest: 0,
      monthsToDebtFree: 0,
      cashRemaining: 0,
    };
  }
}
