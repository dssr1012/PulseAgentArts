import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CircleModule } from './circle/circle.module';
import { TransactionModule } from './transaction/transaction.module';
import { CategoryModule } from './category/category.module';
import { CardModule } from './card/card.module';
import { StatementModule } from './statement/statement.module';
import { AnomalyModule } from './anomaly/anomaly.module';
import { PrivacyModule } from './privacy/privacy.module';
import { ExchangeModule } from './exchange/exchange.module';
import { NotificationModule } from './notification/notification.module';
import { RegexDictModule } from './regex-dict/regex-dict.module';
import { AuditModule } from './audit/audit.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    AuthModule,
    CircleModule,
    TransactionModule,
    CategoryModule,
    CardModule,
    StatementModule,
    AnomalyModule,
    PrivacyModule,
    ExchangeModule,
    NotificationModule,
    RegexDictModule,
    AuditModule,
  ],
})
export class AppModule {}