import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectionService } from './projection.service';
import { PaymentStrategyService } from './payment-strategy.service';
import { LlmOrchestratorService } from '../llm/llm-orchestrator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsOptional, IsInt, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class ProjectionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

class StrategyQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  availableCash: number;
}

@ApiTags('Projection')
@Controller('circles')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class ProjectionController {
  constructor(
    private projectionService: ProjectionService,
    private paymentStrategyService: PaymentStrategyService,
    private llmOrchestrator: LlmOrchestratorService,
  ) {}

  @Get(':id/projection')
  @ApiOperation({ summary: 'Get 12-month financial projection' })
  async getProjection(
    @Param('id') circleId: string,
    @Query() query: ProjectionQueryDto,
  ) {
    const months = query.months || 12;
    const projection = await this.projectionService.getProjection(circleId, months);

    // Add LLM explanation if available
    let explanation: string | undefined;
    if (this.llmOrchestrator) {
      try {
        explanation = await this.llmOrchestrator.explainProjection(projection, 'es');
      } catch {
        // LLM not available, skip explanation
      }
    }

    return { ...projection, explanation };
  }

  @Get(':id/payment-strategy')
  @ApiOperation({ summary: 'Get payment strategy recommendations' })
  async getPaymentStrategy(
    @Param('id') circleId: string,
    @Query() query: StrategyQueryDto,
  ) {
    const strategy = await this.paymentStrategyService.getStrategy(circleId, query.availableCash);

    // Add LLM explanation if available
    if (this.llmOrchestrator) {
      try {
        strategy.reasoning = await this.llmOrchestrator.explainPaymentStrategy(strategy, 'es');
      } catch {
        // LLM not available, use deterministic reasoning
      }
    }

    return strategy;
  }

  @Get(':id/investment-suggestions')
  @ApiOperation({ summary: 'Get investment suggestions based on surplus' })
  async getInvestmentSuggestions(
    @Param('id') circleId: string,
    @CurrentUser('id') userId: string,
  ) {
    const projection = await this.projectionService.getProjection(circleId, 12);

    const surplusData = {
      monthlySurplus: projection.monthlySurplus,
      firstSurplusMonth: projection.firstSurplusMonth,
      totalProjectedIncome: projection.totalProjectedIncome,
      totalProjectedExpenses: projection.totalProjectedExpenses,
      totalProjectedCardPayments: projection.totalProjectedCardPayments,
    };

    let suggestions = '';
    if (this.llmOrchestrator) {
      try {
        suggestions = await this.llmOrchestrator.suggestInvestments(
          surplusData,
          ['MERVAL', 'Bonos'],
          'es',
        );
      } catch {
        suggestions = this.fallbackInvestmentAdvice(surplusData);
      }
    } else {
      suggestions = this.fallbackInvestmentAdvice(surplusData);
    }

    return {
      surplus: surplusData,
      suggestions,
    };
  }

  private fallbackInvestmentAdvice(data: any): string {
    if (data.monthlySurplus <= 0) {
      return `Your monthly surplus is $${data.monthlySurplus.toFixed(2)}. Focus on paying down card debt before investing.`;
    }
    return `Your monthly surplus is $${data.monthlySurplus.toFixed(2)}. Consider: 1) CDR (Certificados de Depósito Argentinos) for capital preservation, 2) Plazo fijo for predictable returns, 3) Continue MERVAL/bonos positions for growth. Surplus starting: ${data.firstSurplusMonth || 'now'}.`;
  }
}
