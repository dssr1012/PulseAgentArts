import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnomalyService } from './anomaly.service';
import { AssociateDto, IrregularQueryDto } from './dto/anomaly.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Irregular Expenses')
@Controller('expenses/irregular')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class AnomalyController {
  constructor(private readonly anomalyService: AnomalyService) {}

  @Get()
  @ApiOperation({ summary: 'List flagged irregular expenses' })
  async listIrregular(
    @Query() query: IrregularQueryDto,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.anomalyService.listIrregular(circleId, query);
  }

  @Post(':id/associate')
  @ApiOperation({ summary: 'Associate irregular expense with statement item' })
  async associateExpense(
    @Param('id') expenseId: string,
    @Body() dto: AssociateDto,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.anomalyService.associateExpense(expenseId, circleId, dto);
  }

  @Post(':id/discard')
  @ApiOperation({ summary: 'Discard a flagged irregular expense' })
  async discardExpense(
    @Param('id') expenseId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.anomalyService.discardExpense(expenseId, circleId);
  }
}