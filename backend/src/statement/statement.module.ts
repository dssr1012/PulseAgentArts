import { Module } from '@nestjs/common';
import { StatementController, CardStatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { PdfStatementParser } from './parsers/pdf-statement.parser';
import { StatementPasswordCrypto } from '../common/statement-password.crypto';
import { AnomalyModule } from '../anomaly/anomaly.module';

@Module({
  imports: [AnomalyModule],
  controllers: [StatementController, CardStatementController],
  providers: [StatementService, PdfStatementParser, StatementPasswordCrypto],
  exports: [StatementService],
})
export class StatementModule {}