import { IsString, IsIn, Matches, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCardDto {
  @ApiProperty({ example: 'Santander' })
  @IsString()
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ enum: ['Visa', 'Mastercard'] })
  @IsIn(['Visa', 'Mastercard'])
  cardType: string;

  @ApiProperty({ enum: ['debit', 'credit'] })
  @IsIn(['debit', 'credit'])
  cardMode: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Must be exactly 4 digits' })
  last4Digits: string;

  @ApiPropertyOptional({ example: 'Daily purchases' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;
}

export class CardResponseDto {
  id: string;
  bankName: string;
  cardType: string;
  lastFourDigits: string;
  createdAt: string;
}