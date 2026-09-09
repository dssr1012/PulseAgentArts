import { Module } from '@nestjs/common';
import { CircleController, InvitationController } from './circle.controller';
import { CircleService } from './circle.service';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [TransactionModule],
  controllers: [CircleController, InvitationController],
  providers: [CircleService],
  exports: [CircleService],
})
export class CircleModule {}
