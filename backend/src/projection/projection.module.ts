import { Module } from '@nestjs/common';
import { ProjectionController } from './projection.controller';
import { ProjectionService } from './projection.service';
import { PaymentStrategyService } from './payment-strategy.service';
import { AiDashboardService } from './ai-dashboard.service';
import { CopilotService } from './copilot.service';
import { CommonModule } from '../common/common.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [CommonModule, LlmModule],
  controllers: [ProjectionController],
  providers: [ProjectionService, PaymentStrategyService, AiDashboardService, CopilotService],
  exports: [ProjectionService, PaymentStrategyService, AiDashboardService, CopilotService],
})
export class ProjectionModule {}
