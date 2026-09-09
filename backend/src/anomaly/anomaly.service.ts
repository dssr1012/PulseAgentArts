import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { AssociateDto, IrregularQueryDto } from './dto/anomaly.dto';

@Injectable()
export class AnomalyService {
  private readonly logger = new Logger(AnomalyService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Background job: Run anomaly detection for all circles with confirmed statements
   */
  @Cron('0 */6 * * *') // Every 6 hours
  async runAnomalyDetection() {
    this.logger.log('Running anomaly detection...');

    const circles = await this.prisma.familyGroup.findMany({
      where: {
        creditCards: {
          some: {
            statements: {
              some: { isConfirmed: true },
            },
          },
        },
      },
      select: { id: true },
    });

    for (const circle of circles) {
      await this.detectAnomaliesForCircle(circle.id);
    }

    this.logger.log('Anomaly detection completed');
  }

  /**
   * Trigger anomaly detection for a specific circle (e.g., after statement confirmation)
   */
  async detectAnomaliesForCircle(circleId: string) {
    const orphanThresholdDays = this.config.get<number>('ANOMALY_ORPHAN_THRESHOLD_DAYS', 30);
    const orphanThresholdDate = new Date(
      Date.now() - orphanThresholdDays * 24 * 60 * 60 * 1000,
    );

    // Get confirmed statement items for this circle
    const statementItems = await this.prisma.statementItem.findMany({
      where: {
        statement: {
          card: { groupId: circleId },
          isConfirmed: true,
        },
      },
    });

    // Get manual expenses for this circle
    const manualExpenses = await this.prisma.transaction.findMany({
      where: {
        groupId: circleId,
        type: 'expense',
        source: 'manual',
        confirmationStatus: 'confirmed',
      },
    });

    // Rule 1: Amount discrepancy detection
    for (const expense of manualExpenses) {
      for (const stmtItem of statementItems) {
        // Same merchant and same date
        if (
          expense.merchantName &&
          expense.merchantName.toLowerCase() === stmtItem.description.toLowerCase() &&
          Math.abs(expense.transactionDate.getTime() - stmtItem.date.getTime()) <
            24 * 60 * 60 * 1000
        ) {
          // Different amounts
          if (Math.abs(Number(expense.amount) - Number(stmtItem.amount)) > 0.01) {
            // Check if alert already exists
            const existingAlert = await this.prisma.anomalyAlert.findFirst({
              where: {
                transactionId: expense.id,
                statementItemId: stmtItem.id,
                status: 'open',
              },
            });

            if (!existingAlert) {
              await this.prisma.anomalyAlert.create({
                data: {
                  groupId: circleId,
                  transactionId: expense.id,
                  statementItemId: stmtItem.id,
                  alertType: 'amount_discrepancy',
                  severity: 'alert',
                  status: 'open',
                },
              });
            }
          }
        }
      }
    }

    // Rule 2: Orphaned duplicate detection
    for (const expense of manualExpenses) {
      // Only check expenses older than threshold
      if (expense.transactionDate > orphanThresholdDate) continue;

      // Check if already has an alert
      const existingAlert = await this.prisma.anomalyAlert.findFirst({
        where: {
          transactionId: expense.id,
          status: 'open',
        },
      });

      if (existingAlert) continue;

      // Check if there's any matching statement item
      const hasMatch = statementItems.some(
        (item) =>
          expense.merchantName &&
          expense.merchantName.toLowerCase() === item.description.toLowerCase() &&
          Math.abs(expense.transactionDate.getTime() - item.date.getTime()) <
            7 * 24 * 60 * 60 * 1000, // Within 7 days
      );

      if (!hasMatch) {
        await this.prisma.anomalyAlert.create({
          data: {
            groupId: circleId,
            transactionId: expense.id,
            alertType: 'orphaned_duplicate',
            severity: 'critical',
            status: 'open',
          },
        });
      }
    }
  }

  async listIrregular(circleId: string, query: IrregularQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      groupId: circleId,
      status: 'open',
    };

    if (query.severity) where.severity = query.severity;

    // Prioritize critical over alert
    const [alerts, total] = await Promise.all([
      this.prisma.anomalyAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: {
          transaction: {
            include: {
              category: true,
              user: { select: { id: true, givenName: true } },
            },
          },
        },
      }),
      this.prisma.anomalyAlert.count({ where }),
    ]);

    const data = alerts.map((alert) => ({
      expenseId: alert.transactionId,
      expense: alert.transaction
        ? {
            id: alert.transaction.id,
            amount: Number(alert.transaction.amount),
            currency: alert.transaction.currency,
            description: alert.transaction.description,
            merchantName: alert.transaction.merchantName,
            transactionDate: alert.transaction.transactionDate,
            category: alert.transaction.category,
            user: alert.transaction.user,
          }
        : null,
      severity: alert.severity,
      reason: alert.alertType,
      matchedStatementItemId: alert.statementItemId,
      availableActions: ['associate', 'edit', 'discard'],
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async associateExpense(
    expenseId: string,
    circleId: string,
    dto: AssociateDto,
  ) {
    const alert = await this.prisma.anomalyAlert.findFirst({
      where: { transactionId: expenseId, groupId: circleId, status: 'open' },
    });

    if (!alert) {
      throw new NotFoundException({
        errorCode: 'ANOMALY_NOT_FOUND',
        message: 'No open anomaly alert found for this expense',
      });
    }

    // Link transaction to statement item
    await this.prisma.$transaction(async (tx) => {
      await tx.statementItem.update({
        where: { id: dto.statementItemId },
        data: { matchedTransactionId: expenseId },
      });

      await tx.anomalyAlert.update({
        where: { id: alert.id },
        data: {
          status: 'resolved',
          resolutionAction: 'associated',
          statementItemId: dto.statementItemId,
        },
      });
    });

    return { status: 'resolved' };
  }

  async discardExpense(expenseId: string, circleId: string) {
    const alert = await this.prisma.anomalyAlert.findFirst({
      where: { transactionId: expenseId, groupId: circleId, status: 'open' },
    });

    if (!alert) {
      throw new NotFoundException({
        errorCode: 'ANOMALY_NOT_FOUND',
        message: 'No open anomaly alert found for this expense',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.anomalyAlert.update({
        where: { id: alert.id },
        data: { status: 'resolved', resolutionAction: 'discarded' },
      });

      await tx.transaction.delete({ where: { id: expenseId } });
    });

    return { status: 'resolved' };
  }
}