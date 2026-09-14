import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WhatsappService } from './whatsapp.service';

class SetDefaultCategoryDto {
  @ApiProperty()
  @IsString()
  categoryId: string;
}

@ApiTags('WhatsApp')
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private whatsappService: WhatsappService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get WhatsApp connection status and QR code' })
  getStatus(@CurrentUser('id') userId: string) {
    return this.whatsappService.getStatus(userId);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Start WhatsApp connection and get QR code' })
  async connect(@CurrentUser('id') userId: string) {
    return this.whatsappService.connect(userId);
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect WhatsApp and clear auth' })
  async disconnect(@CurrentUser('id') userId: string) {
    await this.whatsappService.disconnect(userId);
    return { success: true };
  }

  @Post('default-category')
  @ApiOperation({ summary: 'Set default category for WhatsApp expenses' })
  async setDefaultCategory(
    @CurrentUser('id') userId: string,
    @Body() dto: SetDefaultCategoryDto,
  ) {
    await this.whatsappService.setDefaultCategory(userId, dto.categoryId);
    return { success: true };
  }
}
