import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface AuditEvent {
  eventType: string;
  userId?: string;
  circleId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event with structured JSON format
   */
  log(event: AuditEvent): void {
    const logEntry = {
      ...event,
      timestamp: new Date().toISOString(),
      traceId: crypto.randomUUID(),
    };

    // Sanitize: remove any potential PAN/CVV patterns
    const sanitized = this.sanitize(logEntry);

    this.logger.log(JSON.stringify(sanitized));
  }

  /**
   * Log authentication success
   */
  logAuthSuccess(userId: string, authProvider: string, ipAddress?: string, userAgent?: string) {
    this.log({
      eventType: 'AUTH_SUCCESS',
      userId,
      action: 'login',
      details: { authProvider },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log authentication failure
   */
  logAuthFailure(email: string, ipAddress?: string) {
    this.log({
      eventType: 'AUTH_FAILURE',
      action: 'login_failed',
      details: { email: this.maskEmail(email) },
      ipAddress,
    });
  }

  /**
   * Log account lockout
   */
  logAccountLockout(userId: string, ipAddress?: string) {
    this.log({
      eventType: 'ACCOUNT_LOCKOUT',
      userId,
      action: 'account_locked',
      ipAddress,
    });
  }

  /**
   * Log circle membership change
   */
  logMembershipChange(
    userId: string,
    circleId: string,
    action: 'join' | 'leave' | 'remove',
    performedBy: string,
  ) {
    this.log({
      eventType: 'MEMBERSHIP_CHANGE',
      userId,
      circleId,
      action,
      details: { performedBy },
    });
  }

  /**
   * Log expense modification
   */
  logExpenseModification(
    userId: string,
    expenseId: string,
    action: 'create' | 'update' | 'delete',
  ) {
    this.log({
      eventType: 'EXPENSE_MODIFICATION',
      userId,
      action,
      details: { expenseId },
    });
  }

  /**
   * Log card registration
   */
  logCardRegistration(userId: string, cardId: string) {
    this.log({
      eventType: 'CARD_REGISTRATION',
      userId,
      action: 'card_registered',
      details: { cardId },
    });
  }

  /**
   * Log PAN/CVV rejection
   */
  logSensitiveDataRejection(ipAddress?: string, userAgent?: string) {
    this.log({
      eventType: 'SENSITIVE_DATA_REJECTED',
      action: 'pan_cvv_rejected',
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log invitation event
   */
  logInvitationEvent(
    userId: string,
    circleId: string,
    invitationId: string,
    action: 'created' | 'accepted',
  ) {
    this.log({
      eventType: 'INVITATION_EVENT',
      userId,
      circleId,
      action,
      details: { invitationId },
    });
  }

  /**
   * Sanitize log entry: redact PAN/CVV patterns
   */
  private sanitize(entry: any): any {
    const str = JSON.stringify(entry);
    // Redact 13-19 digit sequences (potential PAN)
    const sanitized = str.replace(/\b\d{13,19}\b/g, '[REDACTED_PAN]');
    // Redact CVV-like fields
    const final = sanitized.replace(
      /"(cvv|security_code|card_number|pan)"\s*:\s*"[^"]*"/gi,
      '"$1":"[REDACTED]"',
    );
    return JSON.parse(final);
  }

  /**
   * Mask email for audit logs
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '[MASKED]';
    const masked = local.charAt(0) + '***' + local.charAt(local.length - 1);
    return `${masked}@${domain}`;
  }
}