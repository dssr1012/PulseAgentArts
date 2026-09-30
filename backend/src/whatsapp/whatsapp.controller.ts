import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WhatsappService } from './whatsapp.service';

class SetDefaultCategoryDto {
  @ApiProperty()
  @IsString()
  categoryId: string;
}

class ExpenseGroupDto {
  @ApiProperty()
  @IsString()
  groupJid: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  groupName?: string;
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

  @Get('groups')
  @ApiOperation({ summary: 'List all WhatsApp groups the user participates in' })
  async listGroups(@CurrentUser('id') userId: string) {
    return this.whatsappService.listWhatsappGroups(userId);
  }

  @Get('expense-groups')
  @ApiOperation({ summary: 'List WhatsApp groups configured as expense sources' })
  async getExpenseGroups(@CurrentUser('id') userId: string) {
    return this.whatsappService.getExpenseGroups(userId);
  }

  @Post('expense-groups')
  @ApiOperation({ summary: 'Register a WhatsApp group as an expense source' })
  async addExpenseGroup(
    @CurrentUser('id') userId: string,
    @Body() dto: ExpenseGroupDto,
  ) {
    await this.whatsappService.addExpenseGroup(userId, dto.groupJid, dto.groupName);
    return { success: true };
  }

  @Delete('expense-groups/:groupJid')
  @ApiOperation({ summary: 'Remove a WhatsApp group from expense sources' })
  async removeExpenseGroup(
    @CurrentUser('id') userId: string,
    @Param('groupJid') groupJid: string,
  ) {
    await this.whatsappService.removeExpenseGroup(userId, groupJid);
    return { success: true };
  }
}
