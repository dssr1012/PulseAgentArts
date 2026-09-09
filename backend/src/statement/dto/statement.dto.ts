import { IsOptional, IsString, IsNumber, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StatementItemDto {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: ['ARS', 'USD', 'EUR'] })
  @IsString()
  currency: string;
}

export class ConfirmStatementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatementItemDto)
  items?: StatementItemDto[];
}

export class StatementPreviewResponseDto {
  previewId: string;
  closingDate: string;
  dueDate: string;
  totalAmount: number;
  minPayment: number;
  currency: string;
  items: StatementItemDto[];
}