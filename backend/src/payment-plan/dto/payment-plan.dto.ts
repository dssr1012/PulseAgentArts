import { IsNumber, IsOptional, IsString, Min, IsBoolean } from 'class-validator';

export class GeneratePlanDto {
  @IsNumber()
  @Min(0)
  availableCash: number;

  @IsOptional()
  @IsString()
  scenario?: string;

  @IsOptional()
  @IsBoolean()
  saveProjection?: boolean;
}

export class UpdateItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualAmount?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MarkPaidDto {
  @IsNumber()
  @Min(0)
  actualAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
