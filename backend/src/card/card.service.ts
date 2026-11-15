import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { CreateCardDto, UpdateCardDto } from './dto/card.dto';

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async createCard(userId: string, circleId: string, dto: CreateCardDto) {
    // PAN/CVV prohibition is enforced at DTO level - no such fields exist
    return this.prisma.creditCard.create({
      data: {
        groupId: circleId,
        bankName: dto.bankName,
        cardType: dto.cardType as any,
        cardMode: dto.cardMode as any,
        lastFourDigits: dto.last4Digits,
        tag: dto.tag,
      },
    });
  }

  async listCards(circleId: string) {
    return this.prisma.creditCard.findMany({
      where: { groupId: circleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCard(cardId: string, circleId: string, dto: UpdateCardDto) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: 'CARD_NOT_FOUND',
        message: 'Credit card not found',
      });
    }

    const data: any = {};
    if (dto.bankName !== undefined) data.bankName = dto.bankName;
    if (dto.cardType !== undefined) data.cardType = dto.cardType as any;
    if (dto.cardMode !== undefined) data.cardMode = dto.cardMode as any;
    if (dto.last4Digits !== undefined) data.lastFourDigits = dto.last4Digits;
    if (dto.tag !== undefined) data.tag = dto.tag;

    return this.prisma.creditCard.update({
      where: { id: cardId },
      data,
    });
  }

  async deleteCard(cardId: string, circleId: string) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: 'CARD_NOT_FOUND',
        message: 'Credit card not found',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const affectedExpenses = await tx.transaction.count({
        where: { cardId, type: 'expense' },
      });

      if (affectedExpenses > 0) {
        await tx.transaction.updateMany({
          where: { cardId },
          data: {
            cardId: null,
            paymentMethod: 'cash',
            confirmationStatus: 'pending_confirmation',
          },
        });
      }

      await tx.recurringTransaction.updateMany({
        where: { cardId },
        data: { cardId: null, paymentMethod: 'cash' },
      });

      await tx.creditCard.delete({ where: { id: cardId } });

      return { affectedExpenses };
    });

    this.logger.log(
      `Card ${cardId} deleted; ${result.affectedExpenses} expense(s) marked for review`,
    );

    return result;
  }
}