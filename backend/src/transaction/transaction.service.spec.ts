import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;

  const mockCategory = { id: 'cat-1', name: 'Alimentación', groupId: 'circle-1' };

  const mockTransaction = {
    id: 'tx-1',
    groupId: 'circle-1',
    userId: 'user-1',
    type: 'expense',
    amount: 5000,
    currency: 'ARS',
    categoryId: 'cat-1',
    description: 'Supermarket',
    merchantName: 'Supermarket X',
    isPrivate: false,
    hiddenUntil: null,
    source: 'manual',
    confirmationStatus: 'confirmed',
    transactionDate: new Date('2026-01-15'),
    createdAt: new Date(),
    category: mockCategory,
    user: { id: 'user-1', givenName: 'Test' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: PrismaService,
          useValue: {
            transaction: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
            },
            category: {
              findFirst: jest.fn(),
            },
            anomalyAlert: {
              updateMany: jest.fn(),
            },
            familyGroup: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Create Expense ──────────────────────────────────────────────

  describe('createExpense', () => {
    const createDto = {
      amount: 5000,
      currency: 'ARS',
      categoryId: 'cat-1',
      description: 'Supermarket',
      merchantName: 'Supermarket X',
      transactionDate: '2026-01-15',
      isPrivate: false,
    };

    it('should create an expense with valid data', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.transaction.create as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await service.createExpense('user-1', 'circle-1', createDto);

      expect(result.id).toBe('tx-1');
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('ARS');
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            groupId: 'circle-1',
            userId: 'user-1',
            type: 'expense',
            amount: 5000,
            currency: 'ARS',
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid category', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createExpense('user-1', 'circle-1', createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when hidden_until is in the past', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);

      await expect(
        service.createExpense('user-1', 'circle-1', {
          ...createDto,
          isPrivate: true,
          hiddenUntil: '2020-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when hidden_until is set without is_private', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);

      await expect(
        service.createExpense('user-1', 'circle-1', {
          ...createDto,
          isPrivate: false,
          hiddenUntil: '2027-12-25',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create private expense with valid hidden_until', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        isPrivate: true,
        hiddenUntil: new Date('2027-12-25'),
      });

      const result = await service.createExpense('user-1', 'circle-1', {
        ...createDto,
        isPrivate: true,
        hiddenUntil: '2027-12-25',
      });

      expect(result.isPrivate).toBe(true);
    });
  });

  // ─── Create Income ───────────────────────────────────────────────

  describe('createIncome', () => {
    it('should create an income record', async () => {
      const incomeTx = {
        ...mockTransaction,
        type: 'income',
        amount: 150000,
      };
      (prisma.transaction.create as jest.Mock).mockResolvedValue(incomeTx);

      const result = await service.createIncome('user-1', 'circle-1', {
        amount: 150000,
        currency: 'ARS',
        categoryId: 'cat-1',
        incomeDate: '2026-01-15',
      });

      expect(result.type).toBe('income');
      expect(result.amount).toBe(150000);
    });
  });

  // ─── List Expenses ───────────────────────────────────────────────

  describe('listExpenses', () => {
    it('should return paginated expenses', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listExpenses('user-1', 'circle-1', {}, 'user-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should apply privacy obfuscation for other users private expenses', async () => {
      const privateTx = {
        ...mockTransaction,
        isPrivate: true,
        userId: 'user-2',
        user: { id: 'user-2', givenName: 'Other' },
        description: 'Birthday Gift',
      };
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([privateTx]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listExpenses('user-1', 'circle-1', {}, 'user-1');

      expect(result.data[0].description).toBe('Gasto Privado de Other');
      expect(result.data[0].merchantName).toBeNull();
    });

    it('should show full details for own private expenses', async () => {
      const privateTx = {
        ...mockTransaction,
        isPrivate: true,
        userId: 'user-1',
        user: { id: 'user-1', givenName: 'Test' },
        description: 'Birthday Gift',
      };
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([privateTx]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listExpenses('user-1', 'circle-1', {}, 'user-1');

      expect(result.data[0].description).toBe('Birthday Gift');
    });

    it('should filter by currency', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await service.listExpenses('user-1', 'circle-1', { currency: 'USD' }, 'user-1');

      const findManyCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.currency).toBe('USD');
    });

    it('should cap limit at 100', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await service.listExpenses('user-1', 'circle-1', { limit: 200 }, 'user-1');

      const findManyCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.take).toBe(100);
    });
  });

  // ─── Update Expense ──────────────────────────────────────────────

  describe('updateExpense', () => {
    it('should allow creator to update their expense', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        amount: 6000,
      });
      (prisma.anomalyAlert.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await service.updateExpense(
        'tx-1',
        'user-1',
        'circle-1',
        { amount: 6000 },
        'member',
      );

      expect(result.amount).toBe(6000);
    });

    it('should allow admin to update any expense', async () => {
      const otherExpense = { ...mockTransaction, userId: 'user-2' };
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(otherExpense);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...otherExpense,
        amount: 6000,
      });
      (prisma.anomalyAlert.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await service.updateExpense(
        'tx-1',
        'user-1',
        'circle-1',
        { amount: 6000 },
        'admin',
      );

      expect(result.amount).toBe(6000);
    });

    it('should throw ForbiddenException for non-creator non-admin', async () => {
      const otherExpense = { ...mockTransaction, userId: 'user-2' };
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(otherExpense);

      await expect(
        service.updateExpense('tx-1', 'user-1', 'circle-1', { amount: 6000 }, 'member'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent expense', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateExpense('tx-99', 'user-1', 'circle-1', { amount: 6000 }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve anomaly alert on update', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.anomalyAlert.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.updateExpense('tx-1', 'user-1', 'circle-1', { amount: 6000 }, 'member');

      expect(prisma.anomalyAlert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'resolved', resolutionAction: 'edited' },
        }),
      );
    });
  });

  // ─── Delete Expense ──────────────────────────────────────────────

  describe('deleteExpense', () => {
    it('should delete expense and resolve anomaly alerts', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.anomalyAlert.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.transaction.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteExpense('tx-1', 'user-1', 'circle-1', 'member');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-creator non-admin', async () => {
      const otherExpense = { ...mockTransaction, userId: 'user-2' };
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(otherExpense);

      await expect(
        service.deleteExpense('tx-1', 'user-1', 'circle-1', 'member'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Balance ─────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('should compute balance from confirmed transactions', async () => {
      (prisma.transaction.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { type: 'income', _sum: { amount: 150000 } },
          { type: 'expense', _sum: { amount: 50000 } },
        ])
        .mockResolvedValueOnce([
          { currency: 'ARS', type: 'income', _sum: { amount: 150000 } },
          { currency: 'ARS', type: 'expense', _sum: { amount: 50000 } },
        ])
        .mockResolvedValueOnce([
          { categoryId: 'cat-1', _sum: { amount: 50000 } },
        ]);
      (prisma.familyGroup.findUnique as jest.Mock).mockResolvedValue({
        baseCurrency: 'ARS',
      });

      const result = await service.getBalance('circle-1');

      expect(result.totalIncome).toBe(150000);
      expect(result.totalExpenses).toBe(50000);
      expect(result.netBalance).toBe(100000);
    });

    it('should include private expenses in totals', async () => {
      (prisma.transaction.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { type: 'expense', _sum: { amount: 10000 } },
        ])
        .mockResolvedValueOnce([
          { currency: 'ARS', type: 'expense', _sum: { amount: 10000 } },
        ])
        .mockResolvedValueOnce([
          { categoryId: 'cat-1', _sum: { amount: 10000 } },
        ]);
      (prisma.familyGroup.findUnique as jest.Mock).mockResolvedValue({
        baseCurrency: 'ARS',
      });

      const result = await service.getBalance('circle-1');

      expect(result.totalExpenses).toBe(10000);
    });

    it('should provide breakdown by currency', async () => {
      (prisma.transaction.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { type: 'income', _sum: { amount: 150000 } },
          { type: 'expense', _sum: { amount: 100 } },
        ])
        .mockResolvedValueOnce([
          { currency: 'ARS', type: 'income', _sum: { amount: 150000 } },
          { currency: 'USD', type: 'expense', _sum: { amount: 100 } },
        ])
        .mockResolvedValueOnce([
          { categoryId: 'cat-1', _sum: { amount: 100 } },
        ]);
      (prisma.familyGroup.findUnique as jest.Mock).mockResolvedValue({
        baseCurrency: 'ARS',
      });

      const result = await service.getBalance('circle-1');

      expect(result.breakdownByCurrency['ARS']).toEqual({ income: 150000, expenses: 0 });
      expect(result.breakdownByCurrency['USD']).toEqual({ income: 0, expenses: 100 });
    });

    it('should include staleness indicator when consolidated', async () => {
      (prisma.transaction.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (prisma.familyGroup.findUnique as jest.Mock).mockResolvedValue({
        baseCurrency: 'ARS',
      });
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('true')  // fx:stale
        .mockResolvedValueOnce('2026-01-01T00:00:00Z'); // fx:last_fetch

      const result = await service.getBalance('circle-1', true);

      expect(result.ratesStale).toBe(true);
      expect(result.lastRateFetch).toBe('2026-01-01T00:00:00Z');
    });
  });

  // ─── Multi-Currency Handling ─────────────────────────────────────

  describe('multi-currency', () => {
    it('should store expense with ARS currency', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        currency: 'ARS',
      });

      const result = await service.createExpense('user-1', 'circle-1', {
        amount: 5000,
        currency: 'ARS',
        categoryId: 'cat-1',
        transactionDate: '2026-01-15',
      });

      expect(result.currency).toBe('ARS');
    });

    it('should store expense with USD currency', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        currency: 'USD',
        amount: 100,
      });

      const result = await service.createExpense('user-1', 'circle-1', {
        amount: 100,
        currency: 'USD',
        categoryId: 'cat-1',
        transactionDate: '2026-01-15',
      });

      expect(result.currency).toBe('USD');
    });

    it('should store expense with EUR currency', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        currency: 'EUR',
        amount: 50,
      });

      const result = await service.createExpense('user-1', 'circle-1', {
        amount: 50,
        currency: 'EUR',
        categoryId: 'cat-1',
        transactionDate: '2026-01-15',
      });

      expect(result.currency).toBe('EUR');
    });
  });

  // ─── Pending Expenses ────────────────────────────────────────────

  describe('getPendingExpenses', () => {
    it('should return pending confirmation expenses', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([mockTransaction]);

      const result = await service.getPendingExpenses('circle-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('confirmExpense', () => {
    it('should confirm a pending expense', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        confirmationStatus: 'confirmed',
      });

      const result = await service.confirmExpense('tx-1', 'circle-1');

      expect(result.confirmationStatus).toBe('confirmed');
    });

    it('should throw NotFoundException for non-existent expense', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.confirmExpense('tx-99', 'circle-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});