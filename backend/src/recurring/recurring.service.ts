import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { CreateRecurringTransactionDto, UpdateRecurringTransactionDto } from './dto/recurring.dto';

@Injectable()
export class RecurringTransactionService {
  private readonly logger = new Logger(RecurringTransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, circleId: string, dto: CreateRecurringTransactionDto) {
    if (dto.paymentMethod === 'card') {
      if (!dto.cardId) {
        throw new NotFoundException({ errorCode: 'RT_CARD_REQUIRED', message: 'cardId is required when paymentMethod is card' });
      }
      const card = await this.prisma.creditCard.findFirst({ where: { id: dto.cardId, groupId: circleId } });
      if (!card) {
        throw new NotFoundException({ errorCode: 'RT_INVALID_CARD', message: 'Card not found in your circle' });
      }
    }

    const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, groupId: circleId } });
    if (!category) {
      throw new NotFoundException({ errorCode: 'RT_INVALID_CATEGORY', message: 'Category not found in your circle' });
    }

    const startDate = new Date(dto.startDate);
    const interval = dto.interval ?? 1;
    const nextExecutionDate = this.calculateNextDate(startDate, dto.frequency, interval, dto.dayOfMonth ?? null, startDate);

    let endDate: Date | null = null;
    if (dto.endDate) {
      endDate = new Date(dto.endDate);
    } else if (dto.totalInstallments) {
      endDate = this.calculateEndDate(startDate, dto.frequency, interval, dto.totalInstallments);
    }

    const created = await this.prisma.recurringTransaction.create({
      data: {
        groupId: circleId,
        userId,
        type: (dto.type as any) || 'expense',
        description: dto.description,
        merchantName: dto.merchantName || null,
        amount: dto.amount,
        currency: dto.currency as any,
        categoryId: dto.categoryId,
        paymentMethod: (dto.paymentMethod as any) || 'cash',
        cardId: dto.paymentMethod === 'card' ? dto.cardId : null,
        frequency: dto.frequency as any,
        interval,
        dayOfMonth: dto.dayOfMonth ?? null,
        startDate,
        endDate,
        nextExecutionDate,
        totalInstallments: dto.totalInstallments ?? null,
        currentInstallment: dto.totalInstallments ? 0 : null,
        originalAmount: dto.originalAmount ?? null,
      },
    });

    // Process immediately if already due (past start date) instead of waiting for cron
    if (created.nextExecutionDate && new Date(created.nextExecutionDate) <= new Date()) {
      await this.processOne(created, new Date());
      return this.prisma.recurringTransaction.findUnique({ where: { id: created.id } });
    }

    return created;
  }

  async list(circleId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { groupId: circleId },
      orderBy: { createdAt: 'desc' },
      include: { category: true, card: true },
    });
  }

  async getOne(id: string, circleId: string) {
    const rt = await this.prisma.recurringTransaction.findUnique({ where: { id } });
    if (!rt || rt.groupId !== circleId) {
      throw new NotFoundException({ errorCode: 'RT_NOT_FOUND', message: 'Recurring transaction not found' });
    }
    return rt;
  }

  async update(id: string, circleId: string, dto: UpdateRecurringTransactionDto) {
    const rt = await this.getOne(id, circleId);

    const data: any = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.merchantName !== undefined) data.merchantName = dto.merchantName;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.interval !== undefined) data.interval = dto.interval;
    if (dto.dayOfMonth !== undefined) data.dayOfMonth = dto.dayOfMonth;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.paymentMethod !== undefined) {
      data.paymentMethod = dto.paymentMethod;
      data.cardId = dto.paymentMethod === 'card' ? dto.cardId : null;
    }

    if (dto.frequency || dto.interval || dto.dayOfMonth) {
      const freq = dto.frequency || rt.frequency;
      const interval = dto.interval ?? rt.interval;
      const dayOfMonth = dto.dayOfMonth ?? rt.dayOfMonth;
      data.nextExecutionDate = this.calculateNextDate(
        rt.lastExecutionDate ? new Date(rt.lastExecutionDate) : new Date(rt.startDate),
        freq, interval, dayOfMonth, new Date(rt.startDate),
      );
    }

    return this.prisma.recurringTransaction.update({ where: { id }, data });
  }

  async delete(id: string, circleId: string) {
    await this.getOne(id, circleId);
    await this.prisma.recurringTransaction.delete({ where: { id } });
  }

  async pause(id: string, circleId: string) {
    await this.getOne(id, circleId);
    return this.prisma.recurringTransaction.update({ where: { id }, data: { isActive: false } });
  }

  async resume(id: string, circleId: string) {
    const rt = await this.getOne(id, circleId);
    const data: any = { isActive: true };
    if (!rt.nextExecutionDate || rt.nextExecutionDate < new Date()) {
      data.nextExecutionDate = this.calculateNextDate(
        new Date(), rt.frequency, rt.interval, rt.dayOfMonth, new Date(rt.startDate),
      );
    }
    return this.prisma.recurringTransaction.update({ where: { id }, data });
  }

  @Cron('0 6 * * *')
  async processDueRecurringTransactions() {
    const now = new Date();
    const due = await this.prisma.recurringTransaction.findMany({
      where: { isActive: true, nextExecutionDate: { lte: now } },
    });

    if (due.length === 0) return;

    this.logger.log(`Processing ${due.length} due recurring transaction(s)`);

    for (const rt of due) {
      await this.processOne(rt, now);
    }
  }

  private async processOne(rt: any, now: Date) {
    const maxCatchUp = 100;
    let count = 0;

    while (rt.isActive && rt.nextExecutionDate && new Date(rt.nextExecutionDate) <= now && count < maxCatchUp) {
      const execDate = new Date(rt.nextExecutionDate);
      const installmentNumber = rt.currentInstallment !== null ? rt.currentInstallment + 1 : null;

      await this.prisma.transaction.create({
        data: {
          groupId: rt.groupId,
          userId: rt.userId,
          type: rt.type,
          amount: rt.amount,
          currency: rt.currency,
          categoryId: rt.categoryId,
          description: rt.description,
          merchantName: rt.merchantName,
          paymentMethod: rt.paymentMethod,
          cardId: rt.cardId,
          transactionDate: execDate,
          source: 'recurring',
          confirmationStatus: 'pending_confirmation',
          recurringTransactionId: rt.id,
          installmentNumber,
        },
      });

      const newInstallment = rt.currentInstallment !== null ? rt.currentInstallment + 1 : null;
      const isComplete = rt.totalInstallments !== null && newInstallment !== null && newInstallment >= rt.totalInstallments;

      const nextDate = isComplete ? null : this.calculateNextDate(execDate, rt.frequency, rt.interval, rt.dayOfMonth, new Date(rt.startDate));

      const updated = await this.prisma.recurringTransaction.update({
        where: { id: rt.id },
        data: {
          lastExecutionDate: execDate,
          currentInstallment: newInstallment,
          nextExecutionDate: nextDate,
          isActive: !isComplete,
        },
      });

      rt = updated;
      count++;
    }

    if (count > 0) {
      this.logger.log(`Recurring ${rt.id}: generated ${count} transaction(s)`);
    }
  }

  private calculateNextDate(fromDate: Date, frequency: string, interval: number, dayOfMonth: number | null, startDate: Date): Date {
    const result = new Date(fromDate);

    if (frequency === 'weekly') {
      result.setDate(result.getDate() + 7 * interval);
    } else if (frequency === 'monthly') {
      result.setMonth(result.getMonth() + interval);
      if (dayOfMonth) {
        result.setDate(dayOfMonth);
      }
    } else if (frequency === 'yearly') {
      result.setFullYear(result.getFullYear() + interval);
      if (dayOfMonth) {
        result.setDate(dayOfMonth);
      }
    }

    if (result <= startDate) {
      if (frequency === 'weekly') {
        result.setTime(startDate.getTime());
        result.setDate(result.getDate() + 7 * interval);
      } else if (frequency === 'monthly') {
        result.setTime(startDate.getTime());
        result.setMonth(result.getMonth() + interval);
        if (dayOfMonth) result.setDate(dayOfMonth);
      } else if (frequency === 'yearly') {
        result.setTime(startDate.getTime());
        result.setFullYear(result.getFullYear() + interval);
        if (dayOfMonth) result.setDate(dayOfMonth);
      }
    }

    return result;
  }

  private calculateEndDate(startDate: Date, frequency: string, interval: number, totalInstallments: number): Date {
    const result = new Date(startDate);
    if (frequency === 'weekly') {
      result.setDate(result.getDate() + 7 * interval * (totalInstallments - 1));
    } else if (frequency === 'monthly') {
      result.setMonth(result.getMonth() + interval * (totalInstallments - 1));
    } else if (frequency === 'yearly') {
      result.setFullYear(result.getFullYear() + interval * (totalInstallments - 1));
    }
    return result;
  }
}
