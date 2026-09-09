import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { PrivacyService } from './privacy.service';

describe('PrivacyService', () => {
  let service: PrivacyService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        {
          provide: PrismaService,
          useValue: {
            transaction: {
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PrivacyService>(PrivacyService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Obfuscation ─────────────────────────────────────────────────

  describe('applyObfuscation', () => {
    const privateTransaction = {
      id: 'tx-1',
      userId: 'user-1',
      isPrivate: true,
      description: 'Birthday Gift',
      merchantName: 'Gift Shop',
      amount: 10000,
      currency: 'ARS',
      user: { id: 'user-1', givenName: 'Juan' },
    };

    it('should return full details for the creator', () => {
      const result = service.applyObfuscation(privateTransaction, 'user-1');

      expect(result.description).toBe('Birthday Gift');
      expect(result.merchantName).toBe('Gift Shop');
      expect(result.amount).toBe(10000);
    });

    it('should obfuscate description for non-creator', () => {
      const result = service.applyObfuscation(privateTransaction, 'user-2');

      expect(result.description).toBe('Gasto Privado de Juan');
      expect(result.merchantName).toBeNull();
    });

    it('should use generic message when creator name is unavailable', () => {
      const noNameTx = {
        ...privateTransaction,
        user: { id: 'user-1', givenName: '' },
      };

      const result = service.applyObfuscation(noNameTx, 'user-2');

      expect(result.description).toBe('Gasto Privado');
    });

    it('should return transaction as-is when not private', () => {
      const publicTx = {
        ...privateTransaction,
        isPrivate: false,
      };

      const result = service.applyObfuscation(publicTx, 'user-2');

      expect(result.description).toBe('Birthday Gift');
      expect(result.merchantName).toBe('Gift Shop');
    });

    it('should include amount in totals even for obfuscated view', () => {
      const result = service.applyObfuscation(privateTransaction, 'user-2');

      // Amount must remain visible for group totals
      expect(result.amount).toBe(10000);
    });
  });

  // ─── Automatic Expiration ────────────────────────────────────────

  describe('expirePrivacy', () => {
    it('should set is_private to false for expired hidden_until', async () => {
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await service.expirePrivacy();

      expect(result.count).toBe(3);
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          isPrivate: true,
          hiddenUntil: {
            not: null,
            lte: expect.any(Date),
          },
        },
        data: {
          isPrivate: false,
          hiddenUntil: null,
        },
      });
    });

    it('should handle zero expired transactions', async () => {
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await service.expirePrivacy();

      expect(result.count).toBe(0);
    });
  });

  // ─── Privacy Validation ──────────────────────────────────────────

  describe('validatePrivacySettings', () => {
    it('should throw error when hidden_until is set without is_private', () => {
      expect(() => {
        service.validatePrivacySettings(false, new Date('2027-12-25'));
      }).toThrow('hidden_until requires is_private to be true');
    });

    it('should throw error when hidden_until is in the past', () => {
      expect(() => {
        service.validatePrivacySettings(true, new Date('2020-01-01'));
      }).toThrow('hidden_until must be in the future');
    });

    it('should pass for valid private expense with future hidden_until', () => {
      expect(() => {
        service.validatePrivacySettings(true, new Date('2027-12-25'));
      }).not.toThrow();
    });

    it('should pass for private expense without hidden_until', () => {
      expect(() => {
        service.validatePrivacySettings(true);
      }).not.toThrow();
    });

    it('should pass for non-private expense without hidden_until', () => {
      expect(() => {
        service.validatePrivacySettings(false);
      }).not.toThrow();
    });
  });
});