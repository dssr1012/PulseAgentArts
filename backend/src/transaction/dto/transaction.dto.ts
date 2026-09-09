import {
  IsNumber,
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ example: 15000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: ['ARS', 'USD', 'EUR'] })
  @IsIn(['ARS', 'USD', 'EUR'])
  currency: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  merchantName?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hiddenUntil?: string;

  @ApiPropertyOptional({ enum: ['manual', 'notification_capture', 'mcp'], default: 'manual' })
  @IsOptional()
  @IsIn(['manual', 'notification_capture', 'mcp'])
  source?: string;

  @ApiPropertyOptional({ enum: ['confirmed', 'pending_confirmation'], default: 'confirmed' })
  @IsOptional()
  @IsIn(['confirmed', 'pending_confirmation'])
  confirmationStatus?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ enum: ['ARS', 'USD', 'EUR'] })
  @IsOptional()
  @IsIn(['ARS', 'USD', 'EUR'])
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  merchantName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hiddenUntil?: string;
}

export class CreateIncomeDto {
  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: ['ARS', 'USD', 'EUR'] })
  @IsIn(['ARS', 'USD', 'EUR'])
  currency: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  incomeDate: string;
}

export class ExpenseQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['ARS', 'USD', 'EUR'] })
  @IsOptional()
  @IsIn(['ARS', 'USD', 'EUR'])
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class TransactionResponseDto {
  id: string;
  type: string;
  amount: number;
  currency: string;
  categoryId: string;
  category?: any;
  description: string | null;
  merchantName: string | null;
  isPrivate: boolean;
  hiddenUntil: string | null;
  source: string;
  confirmationStatus: string;
  transactionDate: string;
  createdAt: string;
  user?: {
    id: string;
    givenName: string;
  };
}

export class BalanceResponseDto {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  baseCurrency: string;
  breakdownByCurrency: Record<string, { income: number; expenses: number }>;
  breakdownByCategory: Record<string, number>;
  consolidatedTotal?: number;
  ratesStale?: boolean;
  lastRateFetch?: string;
}