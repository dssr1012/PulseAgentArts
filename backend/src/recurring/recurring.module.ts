import { Module } from '@nestjs/common';
import { RecurringTransactionController } from './recurring.controller';
import { RecurringTransactionService } from './recurring.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [RecurringTransactionController],
  providers: [RecurringTransactionService],
  exports: [RecurringTransactionService],
})
export class RecurringModule {}
