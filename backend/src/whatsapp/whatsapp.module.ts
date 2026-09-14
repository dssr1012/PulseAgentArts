import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappMessageParser } from './whatsapp-message.parser';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [TransactionModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappMessageParser],
  exports: [WhatsappService],
})
export class WhatsappModule {}
