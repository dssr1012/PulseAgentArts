import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * Send push notification via FCM (placeholder implementation)
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    // In production, this would use Firebase Cloud Messaging
    // For now, log the notification
    this.logger.log(
      `Push notification to ${userId}: ${title} - ${body}`,
    );

    return { sent: true };
  }

  /**
   * Send expense confirmation prompt
   */
  async sendExpenseConfirmationPrompt(
    userId: string,
    expenseId: string,
    amount: number,
    currency: string,
    merchantName: string,
  ) {
    return this.sendPushNotification(
      userId,
      'Nuevo gasto detectado',
      `${merchantName}: ${currency} ${amount}`,
      {
        type: 'expense_confirmation',
        expenseId,
        action: 'confirm_or_discard',
      },
    );
  }

  /**
   * Send irregular expense alert
   */
  async sendIrregularExpenseAlert(
    userId: string,
    expenseId: string,
    severity: string,
    reason: string,
  ) {
    const title = severity === 'critical'
      ? '⚠️ Gasto irregular detectado'
      : '🔍 Posible discrepancia';

    return this.sendPushNotification(
      userId,
      title,
      reason,
      {
        type: 'irregular_expense',
        expenseId,
        severity,
      },
    );
  }

  /**
   * Send invitation notification
   */
  async sendInvitationNotification(
    userId: string,
    circleName: string,
    inviterName: string,
  ) {
    return this.sendPushNotification(
      userId,
      'Invitación a Círculo Familiar',
      `${inviterName} te invitó a "${circleName}"`,
      { type: 'invitation' },
    );
  }
}