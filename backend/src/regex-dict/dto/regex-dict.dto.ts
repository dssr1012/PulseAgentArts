import { IsString, MaxLength, IsOptional, IsInt, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationPatternDto {
  @ApiProperty({ example: 'Mercado Pago' })
  @IsString()
  @MaxLength(50)
  appName: string;

  @ApiProperty({ example: 'Pago de \\$([\\d.,]+) a (.+)' })
  @IsString()
  @MaxLength(1000)
  regexPattern: string;

  @ApiProperty({ example: '["amount", "merchant"]' })
  @IsArray()
  @IsString({ each: true })
  fieldsExtracted: string[];
}

export class UpdateNotificationPatternDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  regexPattern?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldsExtracted?: string[];
}

export class NotificationPatternResponseDto {
  id: string;
  appName: string;
  regexPattern: string;
  version: number;
  fieldsExtracted: string[];
  createdAt: string;
}

export class RegexDictionaryResponseDto {
  version: number;
  patterns: {
    appName: string;
    pattern: string;
    fieldsExtracted: string[];
  }[];
}