import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecurringTransactionService } from './recurring.service';
import { CreateRecurringTransactionDto, UpdateRecurringTransactionDto } from './dto/recurring.dto';

@ApiTags('Recurring Transactions')
@ApiBearerAuth()
@Controller('recurring-transactions')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
export class RecurringTransactionController {
  constructor(private readonly service: RecurringTransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring transaction (automatic debit or installment purchase)' })
  async create(
    @Body() dto: CreateRecurringTransactionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.service.create(userId, circleId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List recurring transactions for your circle' })
  async list(@CurrentUser('circleId') circleId: string) {
    return this.service.list(circleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single recurring transaction' })
  async getOne(
    @Param('id') id: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.service.getOne(id, circleId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring transaction template (affects future generated transactions only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRecurringTransactionDto,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.service.update(id, circleId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a recurring transaction template (past generated transactions are preserved)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.service.delete(id, circleId);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a recurring transaction' })
  async pause(
    @Param('id') id: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.service.pause(id, circleId);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused recurring transaction' })
  async resume(
    @Param('id') id: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.service.resume(id, circleId);
  }
}
