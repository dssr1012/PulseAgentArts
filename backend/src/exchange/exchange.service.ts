import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

@Injectable()
export class ExchangeService {
  private readonly logger = new Logger(ExchangeService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  @Cron('0 0 * * *') // Daily at midnight UTC
  async fetchAndCacheRates() {
    this.logger.log('Fetching exchange rates...');
    const apiUrl = this.config.get<string>('FX_API_URL');
    const baseCurrency = this.config.get<string>('FX_BASE_CURRENCY', 'ARS');

    const ratePairs = [
      { base: 'ARS', targets: ['USD', 'EUR'] },
      { base: 'USD', targets: ['EUR'] },
    ];

    let success = true;

    for (const pair of ratePairs) {
      for (const target of pair.targets) {
        try {
          const rate = await this.fetchRate(pair.base, target);
          if (rate !== null) {
            // Store in DB
            await this.prisma.exchangeRate.upsert({
              where: {
                baseCurrency_targetCurrency: {
                  baseCurrency: pair.base,
                  targetCurrency: target,
                },
              },
              create: {
                baseCurrency: pair.base,
                targetCurrency: target,
                rate,
                fetchedAt: new Date(),
              },
              update: {
                rate,
                fetchedAt: new Date(),
              },
            });

            // Cache in Redis
            const cacheTtl = this.config.get<number>('FX_CACHE_TTL_SECONDS', 86400);
            await this.redis.set(
              `fx:rates:${pair.base}:${target}`,
              rate.toString(),
              cacheTtl,
            );

            // Also store inverse
            const inverseRate = 1 / rate;
            await this.prisma.exchangeRate.upsert({
              where: {
                baseCurrency_targetCurrency: {
                  baseCurrency: target,
                  targetCurrency: pair.base,
                },
              },
              create: {
                baseCurrency: target,
                targetCurrency: pair.base,
                rate: inverseRate,
                fetchedAt: new Date(),
              },
              update: {
                rate: inverseRate,
                fetchedAt: new Date(),
              },
            });

            await this.redis.set(
              `fx:rates:${target}:${pair.base}`,
              inverseRate.toString(),
              cacheTtl,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to fetch rate ${pair.base}->${target}: ${error.message}`);
          success = false;
        }
      }
    }

    // Set staleness indicator
    if (success) {
      await this.redis.set('fx:stale', 'false', 86400);
      await this.redis.set('fx:last_fetch', new Date().toISOString(), 86400);
    } else {
      // Check if existing rates are stale
      const lastFetch = await this.redis.get('fx:last_fetch');
      if (lastFetch) {
        const staleThreshold = this.config.get<number>('FX_STALE_THRESHOLD_HOURS', 24);
        const hoursSinceLastFetch =
          (Date.now() - new Date(lastFetch).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastFetch > staleThreshold) {
          await this.redis.set('fx:stale', 'true', 86400);
        }
      }
    }

    this.logger.log(`Exchange rate fetch completed. Success: ${success}`);
  }

  async getRates() {
    const rates = await this.prisma.exchangeRate.findMany();
    const lastFetch = await this.redis.get('fx:last_fetch');
    const staleFlag = await this.redis.get('fx:stale');

    const ratesMap: Record<string, Record<string, number>> = {};
    for (const r of rates) {
      if (!ratesMap[r.baseCurrency]) ratesMap[r.baseCurrency] = {};
      ratesMap[r.baseCurrency][r.targetCurrency] = Number(r.rate);
    }

    return {
      rates: ratesMap,
      fetchedAt: lastFetch || new Date().toISOString(),
      isStale: staleFlag === 'true',
    };
  }

  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    // Try Redis first
    const cachedRate = await this.redis.get(`fx:rates:${fromCurrency}:${toCurrency}`);
    if (cachedRate) {
      return amount * parseFloat(cachedRate);
    }

    // Fall back to DB
    const dbRate = await this.prisma.exchangeRate.findUnique({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency: fromCurrency,
          targetCurrency: toCurrency,
        },
      },
    });

    if (dbRate) {
      return amount * Number(dbRate.rate);
    }

    throw new Error(`No exchange rate found for ${fromCurrency} -> ${toCurrency}`);
  }

  private async fetchRate(base: string, target: string): Promise<number | null> {
    const apiUrl = this.config.get<string>('FX_API_URL');
    if (!apiUrl) {
      // Return mock rates for development
      const mockRates: Record<string, number> = {
        'ARS-USD': 0.00117,
        'ARS-EUR': 0.00108,
        'USD-EUR': 0.923,
      };
      return mockRates[`${base}-${target}`] || null;
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${apiUrl}/${base}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const rate = data.rates?.[target];
        if (!rate) throw new Error(`Rate not found for ${target}`);

        return rate;
      } catch (error) {
        this.logger.warn(
          `Rate fetch attempt ${attempt}/${maxRetries} failed: ${error.message}`,
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt - 1) * 1000),
          );
        }
      }
    }

    return null;
  }
}