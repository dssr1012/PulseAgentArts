import { IsString, IsIn, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCardDto {
  @ApiProperty({ example: 'Santander' })
  @IsString()
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ enum: ['Visa', 'Mastercard'] })
  @IsIn(['Visa', 'Mastercard'])
  cardType: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Must be exactly 4 digits' })
  last4Digits: string;
}

export class CardResponseDto {
  id: string;
  bankName: string;
  cardType: string;
  lastFourDigits: string;
  createdAt: string;
}