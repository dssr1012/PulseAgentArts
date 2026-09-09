import { IsString, MaxLength, IsOptional, IsIn, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCircleDto {
  @ApiProperty({ example: 'Familia Pérez' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: ['ARS', 'USD', 'EUR'], default: 'ARS' })
  @IsOptional()
  @IsIn(['ARS', 'USD', 'EUR'])
  baseCurrency?: string = 'ARS';
}

export class CreateInvitationDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsEmail()
  email: string;
}

export class CircleResponseDto {
  id: string;
  name: string;
  baseCurrency: string;
  adminUserId: string;
  createdAt: string;
  members?: CircleMemberResponseDto[];
}

export class CircleMemberResponseDto {
  userId: string;
  givenName: string;
  email: string;
  pictureUrl: string | null;
  role: string;
  joinedAt: string;
}

export class InvitationResponseDto {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export class InvitationValidationResponseDto {
  valid: boolean;
  circleName: string;
  email: string;
  expiresAt: string;
}
