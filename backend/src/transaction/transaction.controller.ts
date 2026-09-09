import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  CreateIncomeDto,
  ExpenseQueryDto,
} from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class ExpenseController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new expense' })
  async createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    if (!circleId) {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_NOT_FOUND',
        message: 'You must belong to a Family Circle to create expenses',
      });
    }
    return this.transactionService.createExpense(userId, circleId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List expenses for your circle' })
  async listExpenses(
    @Query() query: ExpenseQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.transactionService.listExpenses(userId, circleId, query, userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List pending confirmation expenses' })
  async listPending(
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.transactionService.getPendingExpenses(circleId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an expense' })
  async updateExpense(
    @Param('id') expenseId: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.transactionService.updateExpense(expenseId, userId, circleId, dto, role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an expense' })
  async deleteExpense(
    @Param('id') expenseId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.transactionService.deleteExpense(expenseId, userId, circleId, role);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm a pending expense' })
  async confirmExpense(
    @Param('id') expenseId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.transactionService.confirmExpense(expenseId, circleId);
  }

  @Post(':id/discard')
  @ApiOperation({ summary: 'Discard a pending expense' })
  async discardExpense(
    @Param('id') expenseId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.transactionService.discardExpense(expenseId, circleId);
  }
}

@ApiTags('Incomes')
@Controller('incomes')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class IncomeController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Create an income record' })
  async createIncome(
    @Body() dto: CreateIncomeDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    if (!circleId) {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_NOT_FOUND',
        message: 'You must belong to a Family Circle to create income records',
      });
    }
    return this.transactionService.createIncome(userId, circleId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List incomes for your circle' })
  async listIncomes(
    @Query() query: ExpenseQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.transactionService.listIncomes(userId, circleId, query);
  }
}