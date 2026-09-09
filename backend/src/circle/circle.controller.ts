import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CircleService } from './circle.service';
import { CreateCircleDto, CreateInvitationDto } from './dto/circle.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TransactionService } from '../transaction/transaction.service';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

class BalanceQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  consolidated?: boolean;
}

@ApiTags('Circles')
@Controller('circles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CircleController {
  constructor(
    private readonly circleService: CircleService,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Family Circle' })
  async createCircle(
    @Body() dto: CreateCircleDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.circleService.createCircle(userId, dto.name, dto.baseCurrency);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get circle details with member list' })
  async getCircle(
    @Param('id') circleId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.circleService.getCircle(circleId, userId);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get balance summary for circle' })
  async getBalance(
    @Param('id') circleId: string,
    @CurrentUser('id') userId: string,
    @Query() query: BalanceQueryDto,
  ) {
    // Verify membership
    await this.circleService.getCircle(circleId, userId);
    return this.transactionService.getBalance(circleId, query.consolidated);
  }

  @Post(':id/invitations')
  @ApiOperation({ summary: 'Send an invitation (admin only)' })
  async createInvitation(
    @Param('id') circleId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.circleService.createInvitation(circleId, dto.email, userId);
  }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'List invitations for circle (admin only)' })
  async getInvitations(
    @Param('id') circleId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.circleService.getInvitations(circleId, userId);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from circle (admin only)' })
  async removeMember(
    @Param('id') circleId: string,
    @Param('userId') memberUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.circleService.removeMember(circleId, memberUserId, userId);
  }
}

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly circleService: CircleService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Validate an invitation token' })
  async validateInvitation(@Param('token') token: string) {
    return this.circleService.validateInvitation(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an invitation' })
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.circleService.acceptInvitation(token, userId);
  }
}
