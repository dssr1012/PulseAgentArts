import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum RecurringFrequency {
  weekly = 'weekly',
  monthly = 'monthly',
  yearly = 'yearly',
}

export class CreateRecurringTransactionDto {
  @ApiProperty({ example: 'Netflix subscription' })
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiPropertyOptional({ example: 'Netflix' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchantName?: string;

  @ApiProperty({ example: 15.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: ['ARS', 'USD', 'EUR'] })
  @IsIn(['ARS', 'USD', 'EUR'])
  currency: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty({ enum: ['expense', 'income'], default: 'expense' })
  @IsOptional()
  @IsIn(['expense', 'income'])
  type?: string;

  @ApiProperty({ enum: ['cash', 'card'], default: 'cash' })
  @IsOptional()
  @IsIn(['cash', 'card'])
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiProperty({ enum: ['weekly', 'monthly', 'yearly'] })
  @IsEnum(RecurringFrequency)
  frequency: string;

  @ApiPropertyOptional({ default: 1, description: 'e.g. 2 = every 2 months' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @ApiPropertyOptional({ description: 'Day of month (1-31) for monthly/yearly' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @ApiProperty({ description: 'ISO date string for the first execution' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'ISO date string, null = indefinite' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Total installments (null = indefinite recurring)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(360)
  totalInstallments?: number;

  @ApiPropertyOptional({ description: 'Original total purchase amount for installments' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  originalAmount?: number;
}

export class UpdateRecurringTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchantName?: string;

  @ApiPropertyOptional()
  @IsOptional()
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

  @ApiPropertyOptional({ enum: ['cash', 'card'] })
  @IsOptional()
  @IsIn(['cash', 'card'])
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiPropertyOptional({ enum: ['weekly', 'monthly', 'yearly'] })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
