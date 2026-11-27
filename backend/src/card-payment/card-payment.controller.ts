import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CardPaymentService } from "./card-payment.service";
import { CreateCardPaymentDto } from "./dto/card-payment.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CircleMembershipGuard } from "../auth/guards/circle-membership.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("Card Payments")
@Controller("cards")
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class CardPaymentController {
  constructor(private readonly cardPaymentService: CardPaymentService) {}

  @Post(":cardId/payments")
  @ApiOperation({ summary: "Record a card payment (settlement)" })
  async createPayment(
    @Param("cardId") cardId: string,
    @Body() dto: CreateCardPaymentDto,
    @CurrentUser("id") userId: string,
    @CurrentUser("circleId") circleId: string,
  ) {
    return this.cardPaymentService.createPayment(userId, circleId, cardId, dto);
  }

  @Get(":cardId/payments")
  @ApiOperation({ summary: "List card payments" })
  async listPayments(
    @Param("cardId") cardId: string,
    @CurrentUser("circleId") circleId: string,
  ) {
    return this.cardPaymentService.listPayments(cardId, circleId);
  }

  @Get(":cardId/balance")
  @ApiOperation({ summary: "Get card balance (expenses - payments)" })
  async getCardBalance(
    @Param("cardId") cardId: string,
    @CurrentUser("circleId") circleId: string,
  ) {
    return this.cardPaymentService.getCardBalance(cardId, circleId);
  }

  @Delete(":cardId/payments/:paymentId")
  @ApiOperation({ summary: "Delete a card payment" })
  async deletePayment(
    @Param("cardId") cardId: string,
    @Param("paymentId") paymentId: string,
    @CurrentUser("circleId") circleId: string,
  ) {
    return this.cardPaymentService.deletePayment(paymentId, circleId);
  }
}
