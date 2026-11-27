import { IsString, IsNumber, IsOptional, IsIn, IsDateString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCardPaymentDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: ["ARS", "USD", "EUR"], default: "ARS" })
  @IsIn(["ARS", "USD", "EUR"])
  currency: string;

  @ApiProperty({ example: "2026-11-28" })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional({ example: "Pago de resumen noviembre" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "statement-uuid" })
  @IsOptional()
  @IsString()
  statementId?: string;
}
