import { Module } from '@nestjs/common';
import { HuaweiCloudLlmService } from './huawei-cloud-llm.service';
import { LlmOrchestratorService } from './llm-orchestrator.service';

@Module({
  providers: [HuaweiCloudLlmService, LlmOrchestratorService],
  exports: [LlmOrchestratorService, HuaweiCloudLlmService],
})
export class LlmModule {}
