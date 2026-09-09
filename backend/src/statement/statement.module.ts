import { Module } from '@nestjs/common';
import { StatementController, CardStatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { PdfStatementParser } from './parsers/pdf-statement.parser';

@Module({
  controllers: [StatementController, CardStatementController],
  providers: [StatementService, PdfStatementParser],
  exports: [StatementService],
})
export class StatementModule {}