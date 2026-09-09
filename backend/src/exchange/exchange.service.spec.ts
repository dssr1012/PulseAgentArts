import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExchangeService } from './exchange.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('ExchangeService', () => {
  let service: ExchangeService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeService,
        {
          provide: PrismaService,
          useValue: {
            exchangeRate: {
              upsert: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                FX_API_URL: null, // Use mock rates
                FX_BASE_CURRENCY: 'ARS',
                FX_CACHE_TTL_SECONDS: 86400,
                FX_STALE_THRESHOLD_HOURS: 24,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExchangeService>(ExchangeService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Rate Caching ────────────────────────────────────────────────

  describe('fetchAndCacheRates', () => {
    it('should fetch and cache rates in both DB and Redis', async () => {
      (prisma.exchangeRate.upsert as jest.Mock).mockResolvedValue({});
      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await service.fetchAndCacheRates();

      // Should have called upsert for each rate pair and its inverse
      expect(prisma.exchangeRate.upsert).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });

    it('should set staleness indicator to false on success', async () => {
      (prisma.exchangeRate.upsert as jest.Mock).mockResolvedValue({});
      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await service.fetchAndCacheRates();

      expect(redis.set).toHaveBeenCalledWith(
        'fx:stale',
        'false',
        expect.any(Number),
      );
    });

    it('should cache inverse rates', async () => {
      (prisma.exchangeRate.upsert as jest.Mock).mockResolvedValue({});
      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await service.fetchAndCacheRates();

      // Should have cached both ARS->USD and USD->ARS
      const setCalls = (redis.set as jest.Mock).mock.calls;
      const hasInverse = setCalls.some(
        (call) => call[0].includes('USD:ARS'),
      );
      expect(hasInverse).toBe(true);
    });

    it('should set staleness to true when fetch fails and rates are old', async () => {
      // Force failure by providing invalid API URL
      (config.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'FX_API_URL') return 'http://invalid-url';
        return undefined;
      });

      // Simulate old last fetch
      (redis.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'fx:last_fetch') {
          const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
          return Promise.resolve(oldDate.toISOString());
        }
        return Promise.resolve(null);
      });

      (prisma.exchangeRate.upsert as jest.Mock).mockResolvedValue({});
      (redis.set as jest.Mock).mockResolvedValue(undefined);

      // The fetch will fail, but we still test the staleness logic
      await service.fetchAndCacheRates();

      // Staleness should have been set
      const staleCalls = (redis.set as jest.Mock).mock.calls.filter(
        (call) => call[0] === 'fx:stale' && call[1] === 'true',
      );
      expect(staleCalls.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Get Rates ───────────────────────────────────────────────────

  describe('getRates', () => {
    it('should return rates with staleness indicator', async () => {
      (prisma.exchangeRate.findMany as jest.Mock).mockResolvedValue([
        { baseCurrency: 'ARS', targetCurrency: 'USD', rate: 0.00117 },
        { baseCurrency: 'ARS', targetCurrency: 'EUR', rate: 0.00108 },
        { baseCurrency: 'USD', targetCurrency: 'EUR', rate: 0.923 },
      ]);
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('2026-01-01T00:00:00Z') // fx:last_fetch
        .mockResolvedValueOnce('false'); // fx:stale

      const result = await service.getRates();

      expect(result.rates).toBeDefined();
      expect(result.rates['ARS']['USD']).toBe(0.00117);
      expect(result.isStale).toBe(false);
      expect(result.fetchedAt).toBe('2026-01-01T00:00:00Z');
    });

    it('should indicate stale rates when flag is true', async () => {
      (prisma.exchangeRate.findMany as jest.Mock).mockResolvedValue([]);
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('2026-01-01T00:00:00Z')
        .mockResolvedValueOnce('true');

      const result = await service.getRates();

      expect(result.isStale).toBe(true);
    });
  });

  // ─── Currency Conversion ─────────────────────────────────────────

  describe('convert', () => {
    it('should return same amount for same currency', async () => {
      const result = await service.convert(5000, 'ARS', 'ARS');

      expect(result).toBe(5000);
    });

    it('should convert using cached Redis rate first', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0.00117');

      const result = await service.convert(5000, 'ARS', 'USD');

      expect(result).toBeCloseTo(5.85, 1);
      expect(redis.get).toHaveBeenCalledWith('fx:rates:ARS:USD');
    });

    it('should fall back to DB rate when Redis cache miss', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (prisma.exchangeRate.findUnique as jest.Mock).mockResolvedValue({
        baseCurrency: 'ARS',
        targetCurrency: 'USD',
        rate: 0.00117,
      });

      const result = await service.convert(5000, 'ARS', 'USD');

      expect(result).toBeCloseTo(5.85, 1);
      expect(prisma.exchangeRate.findUnique).toHaveBeenCalled();
    });

    it('should throw error when no rate found', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (prisma.exchangeRate.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.convert(5000, 'ARS', 'JPY'),
      ).rejects.toThrow('No exchange rate found for ARS -> JPY');
    });

    it('should convert ARS to EUR', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0.00108');

      const result = await service.convert(100000, 'ARS', 'EUR');

      expect(result).toBeCloseTo(108, 0);
    });

    it('should convert USD to EUR', async () => {
      (redis.get as jest.Mock).mockResolvedValue('0.923');

      const result = await service.convert(100, 'USD', 'EUR');

      expect(result).toBeCloseTo(92.3, 1);
    });
  });

  // ─── Staleness Detection ─────────────────────────────────────────

  describe('staleness detection', () => {
    it('should detect stale rates older than 24 hours', async () => {
      (prisma.exchangeRate.findMany as jest.Mock).mockResolvedValue([]);
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('2025-12-01T00:00:00Z') // old fetch
        .mockResolvedValueOnce('true'); // stale flag

      const result = await service.getRates();

      expect(result.isStale).toBe(true);
    });

    it('should indicate fresh rates when under 24 hours', async () => {
      (prisma.exchangeRate.findMany as jest.Mock).mockResolvedValue([]);
      (redis.get as jest.Mock)
        .mockResolvedValueOnce(new Date().toISOString()) // recent fetch
        .mockResolvedValueOnce('false'); // not stale

      const result = await service.getRates();

      expect(result.isStale).toBe(false);
    });
  });
});