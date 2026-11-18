import { Module } from '@nestjs/common';
import { PaymentPlanController } from './payment-plan.controller';
import { PaymentPlanService } from './payment-plan.service';
import { CommonModule } from '../common/common.module';
import { ProjectionModule } from '../projection/projection.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [CommonModule, ProjectionModule, LlmModule],
  controllers: [PaymentPlanController],
  providers: [PaymentPlanService],
  exports: [PaymentPlanService],
})
export class PaymentPlanModule {}
