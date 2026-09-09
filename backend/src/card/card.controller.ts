import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CardService } from './card.service';
import { CreateCardDto } from './dto/card.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Cards')
@Controller('cards')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Post()
  @ApiOperation({ summary: 'Register a credit card (PAN/CVV prohibited)' })
  async createCard(
    @Body() dto: CreateCardDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.cardService.createCard(userId, circleId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List credit cards for your circle' })
  async listCards(@CurrentUser('circleId') circleId: string) {
    return this.cardService.listCards(circleId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a credit card' })
  async deleteCard(
    @Param('id') cardId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.cardService.deleteCard(cardId, circleId);
  }
}