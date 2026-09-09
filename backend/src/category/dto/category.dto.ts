import { IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Entretenimiento' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ example: '🎮' })
  @IsOptional()
  @IsString()
  icon?: string;
}

export class CategoryResponseDto {
  id: string;
  name: string;
  icon: string | null;
  isDefault: boolean;
  createdAt: string;
}