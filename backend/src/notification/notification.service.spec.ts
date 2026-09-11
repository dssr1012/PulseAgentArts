import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { PrismaService } from '../common/prisma.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── sendPushNotification ─────────────────────────────────────────

  describe('sendPushNotification', () => {
    it('should return { sent: true } for a basic notification', async () => {
      const result = await service.sendPushNotification(
        'user-1',
        'Test Title',
        'Test Body',
      );

      expect(result).toEqual({ sent: true });
    });

    it('should return { sent: true } when data payload is provided', async () => {
      const result = await service.sendPushNotification(
        'user-1',
        'Test Title',
        'Test Body',
        { type: 'test', id: '123' },
      );

      expect(result).toEqual({ sent: true });
    });
  });

  // ─── sendExpenseConfirmationPrompt ────────────────────────────────

  describe('sendExpenseConfirmationPrompt', () => {
    it('should call sendPushNotification with expense confirmation title and body', async () => {
      const spy = jest.spyOn(service, 'sendPushNotification');

      await service.sendExpenseConfirmationPrompt(
        'user-1',
        'exp-1',
        5000,
        'ARS',
        'Supermarket X',
      );

      expect(spy).toHaveBeenCalledWith(
        'user-1',
        'Nuevo gasto detectado',
        'Supermarket X: ARS 5000',
        {
          type: 'expense_confirmation',
          expenseId: 'exp-1',
          action: 'confirm_or_discard',
        },
      );
    });

    it('should return { sent: true }', async () => {
      const result = await service.sendExpenseConfirmationPrompt(
        'user-1',
        'exp-1',
        100,
        'USD',
        'Amazon',
      );

      expect(result).toEqual({ sent: true });
    });
  });

  // ─── sendIrregularExpenseAlert ────────────────────────────────────

  describe('sendIrregularExpenseAlert', () => {
    it('should use critical title when severity is critical', async () => {
      const spy = jest.spyOn(service, 'sendPushNotification');

      await service.sendIrregularExpenseAlert(
        'user-1',
        'exp-1',
        'critical',
        'Amount 5x higher than average',
      );

      expect(spy).toHaveBeenCalledWith(
        'user-1',
        '⚠️ Gasto irregular detectado',
        'Amount 5x higher than average',
        {
          type: 'irregular_expense',
          expenseId: 'exp-1',
          severity: 'critical',
        },
      );
    });

    it('should use discrepancy title when severity is not critical', async () => {
      const spy = jest.spyOn(service, 'sendPushNotification');

      await service.sendIrregularExpenseAlert(
        'user-1',
        'exp-1',
        'warning',
        'Slightly above average',
      );

      expect(spy).toHaveBeenCalledWith(
        'user-1',
        '🔍 Posible discrepancia',
        'Slightly above average',
        {
          type: 'irregular_expense',
          expenseId: 'exp-1',
          severity: 'warning',
        },
      );
    });

    it('should return { sent: true }', async () => {
      const result = await service.sendIrregularExpenseAlert(
        'user-1',
        'exp-1',
        'critical',
        'reason',
      );

      expect(result).toEqual({ sent: true });
    });
  });

  // ─── sendInvitationNotification ───────────────────────────────────

  describe('sendInvitationNotification', () => {
    it('should call sendPushNotification with invitation title and body', async () => {
      const spy = jest.spyOn(service, 'sendPushNotification');

      await service.sendInvitationNotification(
        'user-1',
        'My Family Circle',
        'John Doe',
      );

      expect(spy).toHaveBeenCalledWith(
        'user-1',
        'Invitación a Círculo Familiar',
        'John Doe te invitó a "My Family Circle"',
        { type: 'invitation' },
      );
    });

    it('should return { sent: true }', async () => {
      const result = await service.sendInvitationNotification(
        'user-1',
        'Circle',
        'Inviter',
      );

      expect(result).toEqual({ sent: true });
    });
  });
});
