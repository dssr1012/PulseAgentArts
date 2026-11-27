import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateCardPaymentDto } from "./dto/card-payment.dto";

@Injectable()
export class CardPaymentService {
  private readonly logger = new Logger(CardPaymentService.name);

  constructor(private prisma: PrismaService) {}

  async createPayment(
    userId: string,
    circleId: string,
    cardId: string,
    dto: CreateCardPaymentDto,
    source: string = "manual",
  ) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: "CARD_NOT_FOUND",
        message: "Credit card not found in your circle",
      });
    }

    if (dto.statementId) {
      const statement = await this.prisma.cardStatement.findUnique({
        where: { id: dto.statementId },
      });
      if (!statement || statement.cardId !== cardId) {
        throw new BadRequestException({
          errorCode: "INVALID_STATEMENT",
          message: "Statement not found or does not belong to this card",
        });
      }
    }

    const payment = await this.prisma.cardPayment.create({
      data: {
        groupId: circleId,
        userId,
        cardId,
        amount: dto.amount,
        currency: dto.currency as any,
        paymentDate: new Date(dto.paymentDate),
        statementId: dto.statementId,
        description: dto.description,
        source: source as any,
      },
      include: { card: true },
    });

    this.logger.log(
      `Card payment created: ${dto.amount} ${dto.currency} for card ${card.bankName} ${card.lastFourDigits}`,
    );
    return payment;
  }

  async listPayments(cardId: string, circleId: string) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: "CARD_NOT_FOUND",
        message: "Credit card not found",
      });
    }

    return this.prisma.cardPayment.findMany({
      where: { cardId },
      orderBy: { paymentDate: "desc" },
      include: {
        card: true,
        user: { select: { id: true, givenName: true } },
      },
    });
  }

  async getCardBalance(cardId: string, circleId: string) {
    const card = await this.prisma.creditCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: "CARD_NOT_FOUND",
        message: "Credit card not found",
      });
    }

    const expenses = await this.prisma.transaction.aggregate({
      where: { cardId, type: "expense" },
      _sum: { amount: true },
    });

    const payments = await this.prisma.cardPayment.aggregate({
      where: { cardId },
      _sum: { amount: true },
    });

    const totalExpenses = Number(expenses._sum.amount || 0);
    const totalPayments = Number(payments._sum.amount || 0);

    return {
      card,
      totalExpenses,
      totalPayments,
      balance: totalExpenses - totalPayments,
    };
  }

  async getAllCardBalances(circleId: string) {
    const cards = await this.prisma.creditCard.findMany({
      where: { groupId: circleId, cardMode: "credit" },
      orderBy: { createdAt: "desc" },
    });

    const result = [];
    for (const card of cards) {
      const expenses = await this.prisma.transaction.aggregate({
        where: { cardId: card.id, type: "expense" },
        _sum: { amount: true },
      });
      const payments = await this.prisma.cardPayment.aggregate({
        where: { cardId: card.id },
        _sum: { amount: true },
      });
      const totalExpenses = Number(expenses._sum.amount || 0);
      const totalPayments = Number(payments._sum.amount || 0);
      result.push({
        card,
        totalExpenses,
        totalPayments,
        balance: totalExpenses - totalPayments,
      });
    }
    return result;
  }

  async deletePayment(paymentId: string, circleId: string) {
    const payment = await this.prisma.cardPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: "PAYMENT_NOT_FOUND",
        message: "Card payment not found",
      });
    }

    return this.prisma.cardPayment.delete({ where: { id: paymentId } });
  }
}
