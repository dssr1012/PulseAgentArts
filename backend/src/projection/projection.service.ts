import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface MonthlyProjection {
  month: string;              // YYYY-MM
  label: string;              // Human readable (e.g. "Nov 2026")
  income: number;
  expenses: number;
  cardPayments: number;
  netCashFlow: number;        // income - expenses - cardPayments
  cumulativeBalance: number;
  cards: CardProjection[];
}

export interface CardProjection {
  cardId: string;
  bankName: string;
  lastFourDigits: string;
  tag: string | null;
  creditLimit: number | null;
  financingRate: number | null;
  closingDay: number | null;
  dueDay: number | null;
  currentBalance: number;     // Spent in current billing cycle
  projectedBalance: number;   // Projected at month end
  minPayment: number;
  suggestedPayment: number;   // Full balance
  interestIfUnpaid: number;   // Interest if only min payment made
}

export interface ProjectionResult {
  currentMonth: MonthlyProjection;
  months: MonthlyProjection[];   // 12 months including current
  totalProjectedIncome: number;
  totalProjectedExpenses: number;
  totalProjectedCardPayments: number;
  firstSurplusMonth: string | null;   // First month with positive netCashFlow
  monthlySurplus: number;             // Average monthly surplus after month 3
}

@Injectable()
export class ProjectionService {
  private readonly logger = new Logger(ProjectionService.name);

  constructor(private prisma: PrismaService) {}

  async getProjection(circleId: string, months: number = 12): Promise<ProjectionResult> {
    const now = new Date();
    const projections: MonthlyProjection[] = [];

    // Get all cards with metadata
    const cards = await this.prisma.creditCard.findMany({
      where: { groupId: circleId, cardMode: 'credit' },
    });

    // Get recurring transactions
    const recurring = await this.prisma.recurringTransaction.findMany({
      where: { groupId: circleId, isActive: true },
    });

    // Get historical average monthly spend (last 3 months) for projection
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentExpenses = await this.prisma.transaction.findMany({
      where: {
        groupId: circleId,
        type: 'expense',
        confirmationStatus: 'confirmed',
        transactionDate: { gte: threeMonthsAgo },
      },
      select: { amount: true, currency: true, cardId: true, transactionDate: true },
    });

    // Calculate average monthly non-recurring spend per card and overall
    const avgMonthlySpendByCard = new Map<string, number>();
    let avgMonthlySpendTotal = 0;
    for (const exp of recentExpenses) {
      const amt = Number(exp.amount);
      avgMonthlySpendTotal += amt;
      if (exp.cardId) {
        avgMonthlySpendByCard.set(exp.cardId, (avgMonthlySpendByCard.get(exp.cardId) || 0) + amt);
      }
    }
    avgMonthlySpendTotal = avgMonthlySpendTotal / 3;
    for (const [cardId, total] of avgMonthlySpendByCard) {
      avgMonthlySpendByCard.set(cardId, total / 3);
    }

    // Calculate average monthly income (last 3 months)
    const recentIncome = await this.prisma.transaction.findMany({
      where: {
        groupId: circleId,
        type: 'income',
        confirmationStatus: 'confirmed',
        transactionDate: { gte: threeMonthsAgo },
      },
      select: { amount: true },
    });
    const avgMonthlyIncome = recentIncome.reduce((sum, inc) => sum + Number(inc.amount), 0) / 3;

    // Get confirmed income for current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthIncome = await this.prisma.transaction.aggregate({
      where: {
        groupId: circleId,
        type: 'income',
        confirmationStatus: 'confirmed',
        transactionDate: { gte: monthStart },
      },
      _sum: { amount: true },
    });

    const currentMonthExpenses = await this.prisma.transaction.aggregate({
      where: {
        groupId: circleId,
        type: 'expense',
        confirmationStatus: 'confirmed',
        transactionDate: { gte: monthStart },
      },
      _sum: { amount: true },
    });

    let cumulativeBalance = 0;

    for (let i = 0; i < months; i++) {
      const projectionDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = `${projectionDate.getFullYear()}-${String(projectionDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = projectionDate.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });

      const isCurrentMonth = i === 0;

      // Income: current month uses actual, future uses avg + recurring income
      let income: number;
      if (isCurrentMonth) {
        income = Number(currentMonthIncome._sum.amount || 0);
      } else {
        income = avgMonthlyIncome;
      }

      // Add recurring income for this month
      for (const rec of recurring) {
        if (rec.type !== 'income') continue;
        if (this.recurringFallsInMonth(rec, projectionDate)) {
          income += Number(rec.amount);
        }
      }

      // Expenses: current month uses actual, future uses avg + recurring
      let expenses: number;
      if (isCurrentMonth) {
        expenses = Number(currentMonthExpenses._sum.amount || 0);
      } else {
        expenses = avgMonthlySpendTotal;
      }

      // Add recurring expenses for this month
      for (const rec of recurring) {
        if (rec.type !== 'expense') continue;
        if (this.recurringFallsInMonth(rec, projectionDate)) {
          expenses += Number(rec.amount);
        }
      }

      // Card projections
      const cardProjections: CardProjection[] = [];
      let cardPayments = 0;

      for (const card of cards) {
        const cardProj = await this.projectCard(card, circleId, projectionDate, isCurrentMonth, avgMonthlySpendByCard);
        cardProjections.push(cardProj);
        // Card payment = suggested full payment (to avoid interest)
        cardPayments += cardProj.suggestedPayment;
      }

      const netCashFlow = income - expenses - cardPayments;
      cumulativeBalance += netCashFlow;

      projections.push({
        month: monthKey,
        label: monthLabel,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        cardPayments: Math.round(cardPayments * 100) / 100,
        netCashFlow: Math.round(netCashFlow * 100) / 100,
        cumulativeBalance: Math.round(cumulativeBalance * 100) / 100,
        cards: cardProjections,
      });
    }

    const totalProjectedIncome = projections.reduce((s, m) => s + m.income, 0);
    const totalProjectedExpenses = projections.reduce((s, m) => s + m.expenses, 0);
    const totalProjectedCardPayments = projections.reduce((s, m) => s + m.cardPayments, 0);

    const firstSurplus = projections.find((m) => m.netCashFlow > 0);
    const laterMonths = projections.slice(3);
    const monthlySurplus = laterMonths.length > 0
      ? laterMonths.reduce((s, m) => s + m.netCashFlow, 0) / laterMonths.length
      : 0;

    return {
      currentMonth: projections[0],
      months: projections,
      totalProjectedIncome: Math.round(totalProjectedIncome * 100) / 100,
      totalProjectedExpenses: Math.round(totalProjectedExpenses * 100) / 100,
      totalProjectedCardPayments: Math.round(totalProjectedCardPayments * 100) / 100,
      firstSurplusMonth: firstSurplus?.month || null,
      monthlySurplus: Math.round(monthlySurplus * 100) / 100,
    };
  }

  private async projectCard(
    card: any,
    circleId: string,
    projectionDate: Date,
    isCurrentMonth: boolean,
    avgSpendByCard: Map<string, number>,
  ): Promise<CardProjection> {
    const creditLimit = card.creditLimit ? Number(card.creditLimit) : null;
    const financingRate = card.financingRate ? Number(card.financingRate) : null;
    const closingDay = card.closingDay || null;
    const dueDay = card.dueDay || null;

    // Determine billing cycle start
    const cycleStart = closingDay
      ? new Date(projectionDate.getFullYear(), projectionDate.getMonth() - 1, closingDay + 1)
      : new Date(projectionDate.getFullYear(), projectionDate.getMonth(), 1);

    const cycleEnd = closingDay
      ? new Date(projectionDate.getFullYear(), projectionDate.getMonth(), closingDay)
      : new Date(projectionDate.getFullYear(), projectionDate.getMonth() + 1, 0);

    // Get actual expenses on this card in the billing cycle
    let currentBalance: number;
    if (isCurrentMonth) {
      const result = await this.prisma.transaction.aggregate({
        where: {
          groupId: circleId,
          type: 'expense',
          confirmationStatus: 'confirmed',
          cardId: card.id,
          transactionDate: { gte: cycleStart, lte: cycleEnd },
        },
        _sum: { amount: true },
      });
      currentBalance = Number(result._sum.amount || 0);
    } else {
      // Use average spend
      currentBalance = avgSpendByCard.get(card.id) || 0;
    }

    // Projected balance at month end = current + remaining recurring on this card
    const recurring = await this.prisma.recurringTransaction.findMany({
      where: { groupId: circleId, cardId: card.id, isActive: true, type: 'expense' },
    });

    let projectedBalance = currentBalance;
    for (const rec of recurring) {
      if (this.recurringFallsInMonth(rec, projectionDate)) {
        projectedBalance += Number(rec.amount);
      }
    }

    // Minimum payment (typically 3-5% of balance or fixed minimum)
    const minPayment = projectedBalance > 0 ? Math.max(projectedBalance * 0.05, projectedBalance * 0.03) : 0;

    // Interest if only minimum payment (monthly rate = annual / 12)
    const monthlyRate = financingRate ? financingRate / 100 / 12 : 0;
    const interestIfUnpaid = projectedBalance > 0
      ? (projectedBalance - minPayment) * monthlyRate
      : 0;

    return {
      cardId: card.id,
      bankName: card.bankName,
      lastFourDigits: card.lastFourDigits,
      tag: card.tag,
      creditLimit,
      financingRate,
      closingDay,
      dueDay,
      currentBalance: Math.round(currentBalance * 100) / 100,
      projectedBalance: Math.round(projectedBalance * 100) / 100,
      minPayment: Math.round(minPayment * 100) / 100,
      suggestedPayment: Math.round(projectedBalance * 100) / 100,
      interestIfUnpaid: Math.round(interestIfUnpaid * 100) / 100,
    };
  }

  private recurringFallsInMonth(recurring: any, monthDate: Date): boolean {
    if (!recurring.nextExecutionDate && !recurring.lastExecutionDate) return false;

    const refDate = recurring.nextExecutionDate || recurring.lastExecutionDate;
    const ref = new Date(refDate);

    if (recurring.frequency === 'monthly') {
      // Check if the recurring falls in this month
      const next = new Date(ref);
      while (next <= monthDate) {
        const nextMonth = new Date(next);
        nextMonth.setMonth(nextMonth.getMonth() + (recurring.interval || 1));
        if (nextMonth.getFullYear() === monthDate.getFullYear() && nextMonth.getMonth() === monthDate.getMonth()) {
          return true;
        }
        if (nextMonth > monthDate) break;
        next.setTime(nextMonth.getTime());
      }
      // Also check if ref itself is in this month
      return ref.getFullYear() === monthDate.getFullYear() && ref.getMonth() === monthDate.getMonth();
    }

    if (recurring.frequency === 'weekly') {
      // Approximate: check if any weekly occurrence falls in this month
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
