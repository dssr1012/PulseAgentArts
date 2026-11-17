import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappMessageParser } from './whatsapp-message.parser';
import { TransactionModule } from '../transaction/transaction.module';
import { LlmModule } from '../llm/llm.module';
import { ProjectionModule } from '../projection/projection.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TransactionModule, LlmModule, CommonModule, ProjectionModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappMessageParser],
  exports: [WhatsappService],
})
export class WhatsappModule {}
