import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentPlanService } from './payment-plan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { GeneratePlanDto, UpdateItemDto, MarkPaidDto } from './dto/payment-plan.dto';

@ApiTags('Payment Plans')
@Controller('circles')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class PaymentPlanController {
  constructor(private paymentPlanService: PaymentPlanService) {}

  @Post(':id/payment-plans/generate')
  @ApiOperation({ summary: 'Generate (or regenerate) the payment plan for the current month' })
  async generatePlan(
    @Param('id') circleId: string,
    @Body() dto: GeneratePlanDto,
  ) {
    return this.paymentPlanService.generatePlan(
      circleId,
      dto.availableCash,
      dto.scenario,
      dto.saveProjection ?? true,
    );
  }

  @Get(':id/payment-plans/current')
  @ApiOperation({ summary: 'Get the current month payment plan with deviations' })
  async getCurrentPlan(@Param('id') circleId: string) {
    const plan = await this.paymentPlanService.getCurrentPlan(circleId);
    if (!plan) throw new NotFoundException('No payment plan exists for the current month');
    return plan;
  }

  @Get(':id/payment-plans')
  @ApiOperation({ summary: 'List all payment plans for the circle' })
  async listPlans(@Param('id') circleId: string) {
    return this.paymentPlanService.listPlans(circleId);
  }

  @Get(':id/payment-plans/:planId')
  @ApiOperation({ summary: 'Get a specific payment plan with deviations' })
  async getPlan(
    @Param('id') _circleId: string,
    @Param('planId') planId: string,
  ) {
    return this.paymentPlanService.getPlanWithDeviations(planId);
  }

  @Patch(':id/payment-plans/:planId/items/:itemId')
  @ApiOperation({ summary: 'Update a plan item (partial: actualAmount, isPaid, notes)' })
  async updateItem(
    @Param('id') _circleId: string,
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.paymentPlanService.updateItem(planId, itemId, dto);
  }

  @Post(':id/payment-plans/:planId/items/:itemId/mark-paid')
  @ApiOperation({ summary: 'Mark a plan item as paid with the actual amount' })
  async markItemPaid(
    @Param('id') _circleId: string,
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.paymentPlanService.markItemPaid(planId, itemId, dto.actualAmount, dto.notes);
  }

  @Post(':id/payment-plans/:planId/archive')
  @ApiOperation({ summary: 'Archive a payment plan' })
  async archivePlan(
    @Param('id') _circleId: string,
    @Param('planId') planId: string,
  ) {
    return this.paymentPlanService.archivePlan(planId);
  }

  @Get(':id/available-cash-suggestion')
  @ApiOperation({ summary: 'Suggest available cash for card payments (income - fixed expenses - 5% buffer)' })
  async getAvailableCashSuggestion(@Param('id') circleId: string) {
    return this.paymentPlanService.getAvailableCashSuggestion(circleId);
  }

  @Get(':id/payment-recommendation')
  @ApiOperation({ summary: 'Get LLM payment recommendation for splitting available cash across cards' })
  async getPaymentRecommendation(
    @Param('id') circleId: string,
    @Query('cash') cash: string,
  ) {
    const availableCash = parseFloat(cash) || 0;
    return this.paymentPlanService.getLlmRecommendation(circleId, availableCash);
  }

  @Post(':id/payment-plans/:planId/analyze-deviation')
  @ApiOperation({ summary: 'Analyze plan deviations using LLM (cached on the plan)' })
  async analyzeDeviation(
    @Param('id') _circleId: string,
    @Param('planId') planId: string,
  ) {
    return this.paymentPlanService.analyzeDeviation(planId);
  }

  @Get(':id/projection-snapshot/:month')
  @ApiOperation({ summary: 'Get the saved projection snapshot for a month (YYYY-MM)' })
  async getProjectionSnapshot(
    @Param('id') circleId: string,
    @Param('month') month: string,
  ) {
    const snapshot = await this.paymentPlanService.getProjectionSnapshot(circleId, month);
    if (!snapshot) throw new NotFoundException('No projection snapshot for this month');
    return snapshot;
  }
}
