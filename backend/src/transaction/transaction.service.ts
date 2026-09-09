import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  CreateIncomeDto,
  ExpenseQueryDto,
} from './dto/transaction.dto';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createExpense(userId: string, circleId: string, dto: CreateExpenseDto) {
    // Validate category exists in circle
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, groupId: circleId },
    });

    if (!category) {
      throw new BadRequestException({
        errorCode: 'TX_INVALID_CATEGORY',
        message: 'Category not found in your circle',
      });
    }

    // Validate hidden_until is in the future
    if (dto.hiddenUntil && new Date(dto.hiddenUntil) <= new Date()) {
      throw new BadRequestException({
        errorCode: 'PRIVACY_INVALID_DATE',
        message: 'hidden_until must be in the future',
      });
    }

    // Validate hidden_until requires is_private
    if (dto.hiddenUntil && !dto.isPrivate) {
      throw new BadRequestException({
        errorCode: 'PRIVACY_REQUIRES_PRIVATE',
        message: 'hidden_until requires is_private to be true',
      });
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        groupId: circleId,
        userId,
        type: 'expense',
        amount: dto.amount,
        currency: dto.currency as any,
        categoryId: dto.categoryId,
        description: dto.description,
        merchantName: dto.merchantName,
        isPrivate: dto.isPrivate ?? false,
        hiddenUntil: dto.hiddenUntil ? new Date(dto.hiddenUntil) : null,
        source: (dto.source as any) || 'manual',
        confirmationStatus: (dto.confirmationStatus as any) || 'confirmed',
        transactionDate: new Date(dto.transactionDate),
      },
      include: {
        category: true,
        user: { select: { id: true, givenName: true } },
      },
    });

    return this.formatTransaction(transaction);
  }

  async createIncome(userId: string, circleId: string, dto: CreateIncomeDto) {
    const transaction = await this.prisma.transaction.create({
      data: {
        groupId: circleId,
        userId,
        type: 'income',
        amount: dto.amount,
        currency: dto.currency as any,
        categoryId: dto.categoryId,
        description: dto.description,
        source: 'manual',
        confirmationStatus: 'confirmed',
        transactionDate: new Date(dto.incomeDate),
      },
      include: {
        category: true,
        user: { select: { id: true, givenName: true } },
      },
    });

    return this.formatTransaction(transaction);
  }

  async listExpenses(
    userId: string,
    circleId: string,
    query: ExpenseQueryDto,
    requestingUserId: string,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      groupId: circleId,
      type: 'expense',
    };

    if (query.currency) where.currency = query.currency;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.fromDate || query.toDate) {
      where.transactionDate = {};
      if (query.fromDate) where.transactionDate.gte = new Date(query.fromDate);
      if (query.toDate) where.transactionDate.lte = new Date(query.toDate);
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          category: true,
          user: { select: { id: true, givenName: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    // Apply privacy obfuscation
    const data = transactions.map((t) =>
      this.applyPrivacyObfuscation(t, requestingUserId),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listIncomes(
    userId: string,
    circleId: string,
    query: ExpenseQueryDto,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      groupId: circleId,
      type: 'income',
    };

    if (query.currency) where.currency = query.currency;
    if (query.fromDate || query.toDate) {
      where.transactionDate = {};
      if (query.fromDate) where.transactionDate.gte = new Date(query.fromDate);
      if (query.toDate) where.transactionDate.lte = new Date(query.toDate);
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          category: true,
          user: { select: { id: true, givenName: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map(this.formatTransaction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateExpense(
    expenseId: string,
    userId: string,
    circleId: string,
    dto: UpdateExpenseDto,
    userRole: string,
  ) {
    const expense = await this.prisma.transaction.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: 'TX_NOT_FOUND',
        message: 'Expense not found',
      });
    }

    // Only creator or admin can update
    if (expense.userId !== userId && userRole !== 'admin') {
      throw new ForbiddenException({
        errorCode: 'TX_PERMISSION_DENIED',
        message: 'You can only update your own expenses',
      });
    }

    const updateData: any = {};
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.currency) updateData.currency = dto.currency;
    if (dto.categoryId) updateData.categoryId = dto.categoryId;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.merchantName !== undefined) updateData.merchantName = dto.merchantName;
    if (dto.transactionDate) updateData.transactionDate = new Date(dto.transactionDate);
    if (dto.isPrivate !== undefined) updateData.isPrivate = dto.isPrivate;
    if (dto.hiddenUntil !== undefined) updateData.hiddenUntil = dto.hiddenUntil ? new Date(dto.hiddenUntil) : null;

    const updated = await this.prisma.transaction.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        category: true,
        user: { select: { id: true, givenName: true } },
      },
    });

    // Resolve anomaly alert if exists
    await this.prisma.anomalyAlert.updateMany({
      where: { transactionId: expenseId, status: 'open' },
      data: { status: 'resolved', resolutionAction: 'edited' },
    });

    return this.formatTransaction(updated);
  }

  async deleteExpense(
    expenseId: string,
    userId: string,
    circleId: string,
    userRole: string,
  ) {
    const expense = await this.prisma.transaction.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: 'TX_NOT_FOUND',
        message: 'Expense not found',
      });
    }

    if (expense.userId !== userId && userRole !== 'admin') {
      throw new ForbiddenException({
        errorCode: 'TX_PERMISSION_DENIED',
        message: 'You can only delete your own expenses',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Resolve anomaly alerts
      await tx.anomalyAlert.updateMany({
        where: { transactionId: expenseId },
        data: { status: 'resolved', resolutionAction: 'discarded' },
      });

      await tx.transaction.delete({ where: { id: expenseId } });
    });
  }

  async getBalance(circleId: string, consolidated: boolean = false) {
    const group = await this.prisma.familyGroup.findUnique({
      where: { id: circleId },
      select: { baseCurrency: true },
    });

    const confirmedWhere = { groupId: circleId, confirmationStatus: 'confirmed' as const };

    // Compute totals by type at the database level
    const totalsByType = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: confirmedWhere,
      _sum: { amount: true },
    });

    // Compute breakdown by currency and type at the database level
    const breakdownByCurrencyData = await this.prisma.transaction.groupBy({
      by: ['currency', 'type'],
      where: confirmedWhere,
      _sum: { amount: true },
    });

    // Compute category breakdown for expenses at the database level
    const breakdownByCategoryData = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { ...confirmedWhere, type: 'expense' },
      _sum: { amount: true },
    });

    // Build totals
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const row of totalsByType) {
      const amount = Number(row._sum.amount || 0);
      if (row.type === 'income') {
        totalIncome = amount;
      } else {
        totalExpenses = amount;
      }
    }

    // Build currency breakdown
    const breakdownByCurrency: Record<string, { income: number; expenses: number }> = {};

    for (const row of breakdownByCurrencyData) {
      const curr = row.currency;
      const amount = Number(row._sum.amount || 0);

      if (!breakdownByCurrency[curr]) {
        breakdownByCurrency[curr] = { income: 0, expenses: 0 };
      }

      if (row.type === 'income') {
        breakdownByCurrency[curr].income = amount;
      } else {
        breakdownByCurrency[curr].expenses = amount;
      }
    }

    // Build category breakdown
    const breakdownByCategory: Record<string, number> = {};

    for (const row of breakdownByCategoryData) {
      if (row.categoryId) {
        breakdownByCategory[row.categoryId] = Number(row._sum.amount || 0);
      }
    }

    const result: any = {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      baseCurrency: group?.baseCurrency || 'ARS',
      breakdownByCurrency,
      breakdownByCategory,
    };

    if (consolidated) {
      // Add staleness info from Redis
      const ratesStale = await this.redis.get('fx:stale');
      const lastFetch = await this.redis.get('fx:last_fetch');
      result.ratesStale = ratesStale === 'true';
      result.lastRateFetch = lastFetch;
    }

    return result;
  }

  async getPendingExpenses(circleId: string) {
    return this.prisma.transaction.findMany({
      where: {
        groupId: circleId,
        confirmationStatus: 'pending_confirmation',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        user: { select: { id: true, givenName: true } },
      },
    });
  }

  async confirmExpense(expenseId: string, circleId: string) {
    const expense = await this.prisma.transaction.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: 'TX_NOT_FOUND',
        message: 'Expense not found',
      });
    }

    return this.prisma.transaction.update({
      where: { id: expenseId },
      data: { confirmationStatus: 'confirmed' },
    });
  }

  async discardExpense(expenseId: string, circleId: string) {
    const expense = await this.prisma.transaction.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: 'TX_NOT_FOUND',
        message: 'Expense not found',
      });
    }

    await this.prisma.transaction.delete({ where: { id: expenseId } });
  }

  private formatTransaction(tx: any) {
    return {
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      currency: tx.currency,
      categoryId: tx.categoryId,
      category: tx.category,
      description: tx.description,
      merchantName: tx.merchantName,
      isPrivate: tx.isPrivate,
      hiddenUntil: tx.hiddenUntil?.toISOString() || null,
      source: tx.source,
      confirmationStatus: tx.confirmationStatus,
      transactionDate: tx.transactionDate?.toISOString(),
      createdAt: tx.createdAt?.toISOString(),
      user: tx.user,
    };
  }

  private applyPrivacyObfuscation(tx: any, requestingUserId: string) {
    const formatted = this.formatTransaction(tx);

    if (tx.isPrivate && tx.userId !== requestingUserId) {
      const creatorName = tx.user?.givenName || '';
      formatted.description = creatorName
        ? `Gasto Privado de ${creatorName}`
        : 'Gasto Privado';
      formatted.merchantName = null;
    }

    return formatted;
  }
}