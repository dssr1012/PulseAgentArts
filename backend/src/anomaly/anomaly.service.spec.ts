import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';
import { PrismaService } from '../common/prisma.service';

describe('AnomalyService', () => {
  let service: AnomalyService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyService,
        {
          provide: PrismaService,
          useValue: {
            familyGroup: {
              findMany: jest.fn(),
            },
            statementItem: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            transaction: {
              findMany: jest.fn(),
              delete: jest.fn(),
            },
            anomalyAlert: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                ANOMALY_ORPHAN_THRESHOLD_DAYS: 30,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AnomalyService>(AnomalyService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Amount Discrepancy Detection ────────────────────────────────

  describe('detectAnomaliesForCircle - amount discrepancy', () => {
    it('should flag expense with same merchant/date but different amount as alert', async () => {
      const manualExpense = {
        id: 'tx-1',
        groupId: 'circle-1',
        merchantName: 'Supermarket X',
        transactionDate: new Date('2026-01-15'),
        amount: 4500,
        source: 'manual',
        confirmationStatus: 'confirmed',
      };

      const statementItem = {
        id: 'stmt-item-1',
        description: 'Supermarket X',
        date: new Date('2026-01-15'),
        amount: 5000,
      };

      (prisma.statementItem.findMany as jest.Mock).mockResolvedValue([statementItem]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([manualExpense]);
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.anomalyAlert.create as jest.Mock).mockResolvedValue({ id: 'alert-1' });

      await service.detectAnomaliesForCircle('circle-1');

      expect(prisma.anomalyAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'amount_discrepancy',
            severity: 'alert',
            status: 'open',
          }),
        }),
      );
    });

    it('should NOT flag expense when amounts match', async () => {
      const manualExpense = {
        id: 'tx-1',
        groupId: 'circle-1',
        merchantName: 'Supermarket X',
        transactionDate: new Date('2026-01-15'),
        amount: 5000,
        source: 'manual',
        confirmationStatus: 'confirmed',
      };

      const statementItem = {
        id: 'stmt-item-1',
        description: 'Supermarket X',
        date: new Date('2026-01-15'),
        amount: 5000,
      };

      (prisma.statementItem.findMany as jest.Mock).mockResolvedValue([statementItem]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([manualExpense]);

      await service.detectAnomaliesForCircle('circle-1');

      expect(prisma.anomalyAlert.create).not.toHaveBeenCalled();
    });

    it('should NOT create duplicate alert if one already exists', async () => {
      const manualExpense = {
        id: 'tx-1',
        groupId: 'circle-1',
        merchantName: 'Supermarket X',
        transactionDate: new Date('2026-01-15'),
        amount: 4500,
        source: 'manual',
        confirmationStatus: 'confirmed',
      };

      const statementItem = {
        id: 'stmt-item-1',
        description: 'Supermarket X',
        date: new Date('2026-01-15'),
        amount: 5000,
      };

      (prisma.statementItem.findMany as jest.Mock).mockResolvedValue([statementItem]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([manualExpense]);
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-alert' });

      await service.detectAnomaliesForCircle('circle-1');

      expect(prisma.anomalyAlert.create).not.toHaveBeenCalled();
    });
  });

  // ─── Orphaned Duplicate Detection ────────────────────────────────

  describe('detectAnomaliesForCircle - orphaned duplicate', () => {
    it('should flag orphaned expense older than 30 days as critical', async () => {
      const orphanedExpense = {
        id: 'tx-2',
        groupId: 'circle-1',
        merchantName: 'Unknown Store',
        transactionDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        amount: 2000,
        source: 'manual',
        confirmationStatus: 'confirmed',
      };

      (prisma.statementItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([orphanedExpense]);
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.anomalyAlert.create as jest.Mock).mockResolvedValue({ id: 'alert-2' });

      await service.detectAnomaliesForCircle('circle-1');

      expect(prisma.anomalyAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'orphaned_duplicate',
            severity: 'critical',
            status: 'open',
          }),
        }),
      );
    });

    it('should NOT flag orphaned expense younger than 30 days', async () => {
      const recentExpense = {
        id: 'tx-3',
        groupId: 'circle-1',
        merchantName: 'New Store',
        transactionDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        amount: 1000,
        source: 'manual',
        confirmationStatus: 'confirmed',
      };

      (prisma.statementItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([recentExpense]);

      await service.detectAnomaliesForCircle('circle-1');

      expect(prisma.anomalyAlert.create).not.toHaveBeenCalled();
    });

    it('should NOT flag expense if matching statement item exists within 7 days', async () => {
      const expense = {
        id: 'tx-4',
        groupId: 'circle-1',
        merchantName: 'Store A',
        transactionDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        amount: 3000,
        source: 'manual',
        confirmationStatus: 'confirmed',
      };

      const nearbyStatementItem = {
        id: 'stmt-item-2',
        description: 'Store A',
        date: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000), // within 7 days
        amount: 3000,
      };

      (prisma.statementItem.findMany as jest.Mock).mockResolvedValue([nearbyStatementItem]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([expense]);
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue(null);

      await service.detectAnomaliesForCircle('circle-1');

      // Should NOT create orphaned_duplicate alert since there's a nearby match
      expect(prisma.anomalyAlert.create).not.toHaveBeenCalled();
    });
  });

  // ─── List Irregular ──────────────────────────────────────────────

  describe('listIrregular', () => {
    it('should return paginated irregular expenses', async () => {
      const mockAlert = {
        id: 'alert-1',
        transactionId: 'tx-1',
        alertType: 'amount_discrepancy',
        severity: 'alert',
        status: 'open',
        statementItemId: 'stmt-1',
        createdAt: new Date(),
        transaction: {
          id: 'tx-1',
          amount: 4500,
          currency: 'ARS',
          description: 'Test',
          merchantName: 'Store',
          transactionDate: new Date(),
          category: { id: 'cat-1', name: 'Alimentación' },
          user: { id: 'user-1', givenName: 'Test' },
        },
      };

      (prisma.anomalyAlert.findMany as jest.Mock).mockResolvedValue([mockAlert]);
      (prisma.anomalyAlert.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listIrregular('circle-1', {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].severity).toBe('alert');
      expect(result.data[0].availableActions).toEqual(['associate', 'edit', 'discard']);
    });

    it('should prioritize critical over alert severity', async () => {
      (prisma.anomalyAlert.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.anomalyAlert.count as jest.Mock).mockResolvedValue(0);

      await service.listIrregular('circle-1', {});

      const callArgs = (prisma.anomalyAlert.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.orderBy).toEqual([{ severity: 'desc' }, { createdAt: 'desc' }]);
    });

    it('should filter by severity', async () => {
      (prisma.anomalyAlert.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.anomalyAlert.count as jest.Mock).mockResolvedValue(0);

      await service.listIrregular('circle-1', { severity: 'critical' });

      const callArgs = (prisma.anomalyAlert.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.severity).toBe('critical');
    });
  });

  // ─── Associate Expense ───────────────────────────────────────────

  describe('associateExpense', () => {
    it('should link expense to statement item and resolve alert', async () => {
      const mockAlert = {
        id: 'alert-1',
        transactionId: 'tx-1',
        status: 'open',
      };
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue(mockAlert);
      (prisma.statementItem.update as jest.Mock).mockResolvedValue({});
      (prisma.anomalyAlert.update as jest.Mock).mockResolvedValue({});

      const result = await service.associateExpense('tx-1', 'circle-1', {
        statementItemId: 'stmt-1',
      });

      expect(result.status).toBe('resolved');
      expect(prisma.anomalyAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'resolved',
            resolutionAction: 'associated',
          }),
        }),
      );
    });

    it('should throw NotFoundException if no open alert exists', async () => {
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.associateExpense('tx-1', 'circle-1', { statementItemId: 'stmt-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Discard Expense ─────────────────────────────────────────────

  describe('discardExpense', () => {
    it('should resolve alert and delete the expense', async () => {
      const mockAlert = {
        id: 'alert-1',
        transactionId: 'tx-1',
        status: 'open',
      };
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue(mockAlert);
      (prisma.anomalyAlert.update as jest.Mock).mockResolvedValue({});
      (prisma.transaction.delete as jest.Mock).mockResolvedValue(undefined);

      const result = await service.discardExpense('tx-1', 'circle-1');

      expect(result.status).toBe('resolved');
      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
    });

    it('should throw NotFoundException if no open alert exists', async () => {
      (prisma.anomalyAlert.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.discardExpense('tx-1', 'circle-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});