import { Module } from "@nestjs/common";
import { CardPaymentController } from "./card-payment.controller";
import { CardPaymentService } from "./card-payment.service";

@Module({
  controllers: [CardPaymentController],
  providers: [CardPaymentService],
  exports: [CardPaymentService],
})
export class CardPaymentModule {}
