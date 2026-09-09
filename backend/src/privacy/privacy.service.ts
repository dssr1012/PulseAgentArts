import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Daily cron job: Expire privacy for transactions where hidden_until has passed
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expirePrivacy() {
    this.logger.log('Running privacy expiration check...');

    const result = await this.prisma.transaction.updateMany({
      where: {
        isPrivate: true,
        hiddenUntil: {
          not: null,
          lte: new Date(),
        },
      },
      data: {
        isPrivate: false,
        hiddenUntil: null,
      },
    });

    this.logger.log(`Privacy expired for ${result.count} transactions`);
    return result;
  }

  /**
   * Apply privacy obfuscation to a transaction for non-creator viewing
   */
  applyObfuscation(transaction: any, requestingUserId: string): any {
    if (!transaction.isPrivate) return transaction;

    if (transaction.userId === requestingUserId) {
      // Creator sees full details
      return transaction;
    }

    // Non-creator sees obfuscated view
    const creatorName = transaction.user?.givenName || '';
    return {
      ...transaction,
      description: creatorName
        ? `Gasto Privado de ${creatorName}`
        : 'Gasto Privado',
      merchantName: null,
      // Amount remains visible for totals
    };
  }

  /**
   * Validate privacy settings for a transaction
   */
  validatePrivacySettings(isPrivate: boolean, hiddenUntil?: Date): void {
    if (hiddenUntil && !isPrivate) {
      throw new Error('hidden_until requires is_private to be true');
    }

    if (hiddenUntil && hiddenUntil <= new Date()) {
      throw new Error('hidden_until must be in the future');
    }
  }
}