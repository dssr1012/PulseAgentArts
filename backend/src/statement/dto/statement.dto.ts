import { IsOptional, IsString, IsNumber, IsDateString, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
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

export class AcceptItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  statementItemId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class AcceptItemsDto {
  @ApiProperty({ type: [AcceptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcceptItemDto)
  items: AcceptItemDto[];
}

export class ReportFraudDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  statementItemIds: string[];
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
