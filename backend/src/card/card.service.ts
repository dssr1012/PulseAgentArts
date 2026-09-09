import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { CreateCardDto } from './dto/card.dto';

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
        lastFourDigits: dto.last4Digits,
      },
    });
  }

  async listCards(circleId: string) {
    return this.prisma.creditCard.findMany({
      where: { groupId: circleId },
      orderBy: { createdAt: 'desc' },
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

    await this.prisma.creditCard.delete({ where: { id: cardId } });
  }
}