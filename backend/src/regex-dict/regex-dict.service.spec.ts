import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RegexDictService } from './regex-dict.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('RegexDictService', () => {
  let service: RegexDictService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;

  const mockPattern = {
    id: 'pattern-1',
    appName: 'Mercado Pago',
    regexPattern: 'Pago de \\$([\\d.,]+) a (.+)',
    version: 1,
    fieldsExtracted: JSON.stringify(['amount', 'merchant']),
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegexDictService,
        {
          provide: PrismaService,
          useValue: {
            notificationPattern: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            del: jest.fn().mockResolvedValue(undefined),
            getJSON: jest.fn().mockResolvedValue(null),
            setJSON: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<RegexDictService>(RegexDictService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createPattern ────────────────────────────────────────────────

  describe('createPattern', () => {
    const createDto = {
      appName: 'Mercado Pago',
      regexPattern: 'Pago de \\$([\\d.,]+) a (.+)',
      fieldsExtracted: ['amount', 'merchant'],
    };

    it('should create a pattern with version 1 when no patterns exist', async () => {
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.notificationPattern.create as jest.Mock).mockResolvedValue(mockPattern);

      const result = await service.createPattern(createDto);

      expect(result.appName).toBe('Mercado Pago');
      expect(result.version).toBe(1);
      expect(result.fieldsExtracted).toEqual(['amount', 'merchant']);
      expect(prisma.notificationPattern.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appName: 'Mercado Pago',
            version: 1,
            fieldsExtracted: JSON.stringify(['amount', 'merchant']),
          }),
        }),
      );
    });

    it('should increment version based on max existing version', async () => {
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue({ version: 3 });
      (prisma.notificationPattern.create as jest.Mock).mockResolvedValue({
        ...mockPattern,
        version: 4,
      });

      const result = await service.createPattern(createDto);

      expect(result.version).toBe(4);
      expect(prisma.notificationPattern.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 4 }),
        }),
      );
    });

    it('should invalidate the Redis cache after creating', async () => {
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.notificationPattern.create as jest.Mock).mockResolvedValue(mockPattern);

      await service.createPattern(createDto);

      expect(redis.del).toHaveBeenCalledWith('regex:dict:latest');
    });
  });

  // ─── updatePattern ────────────────────────────────────────────────

  describe('updatePattern', () => {
    const updateDto = {
      appName: 'Mercado Pago Updated',
    };

    it('should update an existing pattern and increment version', async () => {
      (prisma.notificationPattern.findUnique as jest.Mock).mockResolvedValue(mockPattern);
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue({ version: 1 });
      (prisma.notificationPattern.update as jest.Mock).mockResolvedValue({
        ...mockPattern,
        appName: 'Mercado Pago Updated',
        version: 2,
      });

      const result = await service.updatePattern('pattern-1', updateDto);

      expect(result.appName).toBe('Mercado Pago Updated');
      expect(result.version).toBe(2);
      expect(prisma.notificationPattern.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pattern-1' },
          data: expect.objectContaining({
            appName: 'Mercado Pago Updated',
            version: 2,
          }),
        }),
      );
    });

    it('should throw NotFoundException when pattern does not exist', async () => {
      (prisma.notificationPattern.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updatePattern('nonexistent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should invalidate the Redis cache after updating', async () => {
      (prisma.notificationPattern.findUnique as jest.Mock).mockResolvedValue(mockPattern);
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue({ version: 1 });
      (prisma.notificationPattern.update as jest.Mock).mockResolvedValue({
        ...mockPattern,
        version: 2,
      });

      await service.updatePattern('pattern-1', updateDto);

      expect(redis.del).toHaveBeenCalledWith('regex:dict:latest');
    });

    it('should update regexPattern and fieldsExtracted when provided', async () => {
      (prisma.notificationPattern.findUnique as jest.Mock).mockResolvedValue(mockPattern);
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue({ version: 1 });
      (prisma.notificationPattern.update as jest.Mock).mockResolvedValue({
        ...mockPattern,
        regexPattern: 'new-pattern',
        version: 2,
      });

      await service.updatePattern('pattern-1', {
        regexPattern: 'new-pattern',
        fieldsExtracted: ['field1'],
      });

      expect(prisma.notificationPattern.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            regexPattern: 'new-pattern',
            fieldsExtracted: JSON.stringify(['field1']),
            version: 2,
          }),
        }),
      );
    });
  });

  // ─── deletePattern ────────────────────────────────────────────────

  describe('deletePattern', () => {
    it('should delete an existing pattern', async () => {
      (prisma.notificationPattern.findUnique as jest.Mock).mockResolvedValue(mockPattern);
      (prisma.notificationPattern.delete as jest.Mock).mockResolvedValue(mockPattern);

      await service.deletePattern('pattern-1');

      expect(prisma.notificationPattern.delete).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
      });
    });

    it('should throw NotFoundException when pattern does not exist', async () => {
      (prisma.notificationPattern.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deletePattern('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should invalidate the Redis cache after deleting', async () => {
      (prisma.notificationPattern.findUnique as jest.Mock).mockResolvedValue(mockPattern);
      (prisma.notificationPattern.delete as jest.Mock).mockResolvedValue(mockPattern);

      await service.deletePattern('pattern-1');

      expect(redis.del).toHaveBeenCalledWith('regex:dict:latest');
    });
  });

  // ─── getDictionary ────────────────────────────────────────────────

  describe('getDictionary', () => {
    it('should return cached result from Redis when available', async () => {
      const cached = { version: 1, patterns: [{ appName: 'Test', pattern: '.*', fieldsExtracted: [] }] };
      (redis.getJSON as jest.Mock).mockResolvedValue(cached);

      const result = await service.getDictionary();

      expect(result).toEqual(cached);
      expect(prisma.notificationPattern.findMany).not.toHaveBeenCalled();
    });

    it('should return { version: 0, patterns: [] } when no patterns exist in DB', async () => {
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getDictionary();

      expect(result).toEqual({ version: 0, patterns: [] });
    });

    it('should fetch from DB and cache when not in Redis', async () => {
      (prisma.notificationPattern.findFirst as jest.Mock).mockResolvedValue({ version: 2 });
      (prisma.notificationPattern.findMany as jest.Mock).mockResolvedValue([
        { ...mockPattern, version: 2 },
      ]);

      const result = await service.getDictionary();

      expect(result.version).toBe(2);
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].appName).toBe('Mercado Pago');
      expect(result.patterns[0].pattern).toBe('Pago de \\$([\\d.,]+) a (.+)');
      expect(result.patterns[0].fieldsExtracted).toEqual(['amount', 'merchant']);
      expect(redis.setJSON).toHaveBeenCalledWith(
        'regex:dict:latest',
        expect.objectContaining({ version: 2 }),
        3600,
      );
    });

    it('should fetch patterns at or before a specific version', async () => {
      (prisma.notificationPattern.findMany as jest.Mock).mockResolvedValue([
        { ...mockPattern, version: 1 },
      ]);

      const result = await service.getDictionary(1);

      expect(prisma.notificationPattern.findMany).toHaveBeenCalledWith({
        where: { version: { lte: 1 } },
        orderBy: { version: 'desc' },
      });
      expect(result.version).toBe(1);
    });
  });

  // ─── listPatterns ─────────────────────────────────────────────────

  describe('listPatterns', () => {
    it('should return all patterns with parsed fieldsExtracted', async () => {
      (prisma.notificationPattern.findMany as jest.Mock).mockResolvedValue([
        mockPattern,
        {
          id: 'pattern-2',
          appName: 'Galicia',
          regexPattern: 'Compra \\$([\\d.,]+)',
          version: 2,
          fieldsExtracted: JSON.stringify(['amount']),
          createdAt: new Date('2026-01-02'),
        },
      ]);

      const result = await service.listPatterns();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('pattern-1');
      expect(result[0].fieldsExtracted).toEqual(['amount', 'merchant']);
      expect(result[1].id).toBe('pattern-2');
      expect(result[1].fieldsExtracted).toEqual(['amount']);
    });

    it('should return empty array when no patterns exist', async () => {
      (prisma.notificationPattern.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.listPatterns();

      expect(result).toEqual([]);
    });

    it('should order by createdAt desc', async () => {
      (prisma.notificationPattern.findMany as jest.Mock).mockResolvedValue([]);

      await service.listPatterns();

      expect(prisma.notificationPattern.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
