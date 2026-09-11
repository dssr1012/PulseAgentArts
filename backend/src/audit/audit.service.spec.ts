import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuditService, AuditEvent } from './audit.service';
import { PrismaService } from '../common/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let loggerLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    // Spy on the internal Logger.log to capture output without printing
    loggerLogSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── log ──────────────────────────────────────────────────────────

  describe('log', () => {
    it('should write a JSON string to the logger with timestamp and traceId', () => {
      const event: AuditEvent = {
        eventType: 'TEST',
        action: 'unit_test',
      };

      service.log(event);

      expect(loggerLogSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(loggerLogSpy.mock.calls[0][0]);
      expect(logged.eventType).toBe('TEST');
      expect(logged.action).toBe('unit_test');
      expect(logged.timestamp).toBeDefined();
      expect(logged.traceId).toBeDefined();
      expect(typeof logged.traceId).toBe('string');
    });

    it('should preserve userId, circleId, ipAddress, and userAgent', () => {
      const event: AuditEvent = {
        eventType: 'TEST',
        userId: 'user-1',
        circleId: 'circle-1',
        action: 'test_action',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        details: { foo: 'bar' },
      };

      service.log(event);

      const logged = JSON.parse(loggerLogSpy.mock.calls[0][0]);
      expect(logged.userId).toBe('user-1');
      expect(logged.circleId).toBe('circle-1');
      expect(logged.ipAddress).toBe('10.0.0.1');
      expect(logged.userAgent).toBe('Mozilla/5.0');
      expect(logged.details.foo).toBe('bar');
    });

    it('should redact 13-19 digit PAN patterns from details', () => {
      const event: AuditEvent = {
        eventType: 'TEST',
        action: 'test',
        details: { cardNumber: '4539578763624863' },
      };

      service.log(event);

      const logged = JSON.parse(loggerLogSpy.mock.calls[0][0]);
      expect(logged.details.cardNumber).toBe('[REDACTED_PAN]');
    });

    it('should redact cvv / security_code / card_number / pan fields', () => {
      const event: AuditEvent = {
        eventType: 'TEST',
        action: 'test',
        details: {
          cvv: '123',
          security_code: '456',
          card_number: '4539578763624863',
          pan: '5555444433332222',
        },
      };

      service.log(event);

      const logged = JSON.parse(loggerLogSpy.mock.calls[0][0]);
      expect(logged.details.cvv).toBe('[REDACTED]');
      expect(logged.details.security_code).toBe('[REDACTED]');
      expect(logged.details.card_number).toBe('[REDACTED]');
      expect(logged.details.pan).toBe('[REDACTED]');
    });
  });

  // ─── logAuthSuccess ───────────────────────────────────────────────

  describe('logAuthSuccess', () => {
    it('should call log with AUTH_SUCCESS event and authProvider in details', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logAuthSuccess('user-1', 'traditional', '10.0.0.1', 'Mozilla/5.0');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AUTH_SUCCESS',
          userId: 'user-1',
          action: 'login',
          details: { authProvider: 'traditional' },
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  // ─── logAuthFailure ───────────────────────────────────────────────

  describe('logAuthFailure', () => {
    it('should call log with AUTH_FAILURE event and masked email', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logAuthFailure('test@example.com', '10.0.0.1');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AUTH_FAILURE',
          action: 'login_failed',
          ipAddress: '10.0.0.1',
        }),
      );
      // Verify email is masked in details
      const callArg = logSpy.mock.calls[0][0];
      expect(callArg.details.email).not.toBe('test@example.com');
      expect(callArg.details.email).toContain('***');
      expect(callArg.details.email).toContain('@example.com');
    });

    it('should mask email as firstChar***lastChar@domain', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logAuthFailure('john@example.com');

      const callArg = logSpy.mock.calls[0][0];
      expect(callArg.details.email).toBe('j***n@example.com');
    });
  });

  // ─── logAccountLockout ────────────────────────────────────────────

  describe('logAccountLockout', () => {
    it('should call log with ACCOUNT_LOCKOUT event', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logAccountLockout('user-1', '10.0.0.1');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ACCOUNT_LOCKOUT',
          userId: 'user-1',
          action: 'account_locked',
          ipAddress: '10.0.0.1',
        }),
      );
    });
  });

  // ─── logMembershipChange ──────────────────────────────────────────

  describe('logMembershipChange', () => {
    it('should call log with MEMBERSHIP_CHANGE event and performedBy in details', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logMembershipChange('user-1', 'circle-1', 'join', 'admin-1');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'MEMBERSHIP_CHANGE',
          userId: 'user-1',
          circleId: 'circle-1',
          action: 'join',
          details: { performedBy: 'admin-1' },
        }),
      );
    });

    it('should support leave and remove actions', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logMembershipChange('user-1', 'circle-1', 'leave', 'admin-1');
      service.logMembershipChange('user-2', 'circle-1', 'remove', 'admin-1');

      expect(logSpy).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ action: 'leave' }),
      );
      expect(logSpy).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ action: 'remove' }),
      );
    });
  });

  // ─── logExpenseModification ──────────────────────────────────────

  describe('logExpenseModification', () => {
    it('should call log with EXPENSE_MODIFICATION event and expenseId in details', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logExpenseModification('user-1', 'exp-1', 'create');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EXPENSE_MODIFICATION',
          userId: 'user-1',
          action: 'create',
          details: { expenseId: 'exp-1' },
        }),
      );
    });

    it('should support update and delete actions', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logExpenseModification('user-1', 'exp-1', 'update');
      service.logExpenseModification('user-1', 'exp-1', 'delete');

      expect(logSpy).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ action: 'update' }),
      );
      expect(logSpy).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ action: 'delete' }),
      );
    });
  });

  // ─── logCardRegistration ──────────────────────────────────────────

  describe('logCardRegistration', () => {
    it('should call log with CARD_REGISTRATION event and cardId in details', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logCardRegistration('user-1', 'card-1');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CARD_REGISTRATION',
          userId: 'user-1',
          action: 'card_registered',
          details: { cardId: 'card-1' },
        }),
      );
    });
  });

  // ─── logSensitiveDataRejection ────────────────────────────────────

  describe('logSensitiveDataRejection', () => {
    it('should call log with SENSITIVE_DATA_REJECTED event', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logSensitiveDataRejection('10.0.0.1', 'Mozilla/5.0');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'SENSITIVE_DATA_REJECTED',
          action: 'pan_cvv_rejected',
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  // ─── logInvitationEvent ───────────────────────────────────────────

  describe('logInvitationEvent', () => {
    it('should call log with INVITATION_EVENT event and invitationId in details', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logInvitationEvent('user-1', 'circle-1', 'inv-1', 'created');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'INVITATION_EVENT',
          userId: 'user-1',
          circleId: 'circle-1',
          action: 'created',
          details: { invitationId: 'inv-1' },
        }),
      );
    });

    it('should support accepted action', () => {
      const logSpy = jest.spyOn(service, 'log');

      service.logInvitationEvent('user-1', 'circle-1', 'inv-1', 'accepted');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accepted' }),
      );
    });
  });
});
