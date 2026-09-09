import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssociateDto {
  @ApiProperty()
  @IsString()
  statementItemId: string;
}

export class IrregularQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['alert', 'critical'] })
  @IsOptional()
  @IsIn(['alert', 'critical'])
  severity?: string;
}

export class IrregularExpenseResponseDto {
  expenseId: string;
  expense: any;
  severity: string;
  reason: string;
  matchedStatementItemId: string | null;
  availableActions: string[];
}