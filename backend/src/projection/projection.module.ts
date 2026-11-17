import { Module } from '@nestjs/common';
import { ProjectionController } from './projection.controller';
import { ProjectionService } from './projection.service';
import { PaymentStrategyService } from './payment-strategy.service';
import { CommonModule } from '../common/common.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [CommonModule, LlmModule],
  controllers: [ProjectionController],
  providers: [ProjectionService, PaymentStrategyService],
  exports: [ProjectionService, PaymentStrategyService],
})
export class ProjectionModule {}
