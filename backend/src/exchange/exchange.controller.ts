import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExchangeService } from './exchange.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class RateQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  version?: number;
}

@ApiTags('Exchange Rates')
@Controller('exchange-rates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get()
  @ApiOperation({ summary: 'Get current exchange rates with staleness indicator' })
  async getRates() {
    return this.exchangeService.getRates();
  }
}