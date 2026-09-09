import { Module } from '@nestjs/common';
import { ExpenseController, IncomeController } from './transaction.controller';
import { TransactionService } from './transaction.service';

@Module({
  controllers: [ExpenseController, IncomeController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}