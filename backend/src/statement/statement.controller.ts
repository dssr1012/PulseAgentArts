import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StatementService } from './statement.service';
import { ConfirmStatementDto } from './dto/statement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Statements')
@Controller('statements')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class StatementController {
  constructor(private readonly statementService: StatementService) {}

  @Post(':previewId/confirm')
  @ApiOperation({ summary: 'Confirm a parsed statement and create expenses' })
  async confirmStatement(
    @Param('previewId') previewId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
    @Body() dto?: ConfirmStatementDto,
  ) {
    return this.statementService.confirmStatement(previewId, userId, circleId, dto);
  }
}

@ApiTags('Card Statements')
@Controller('cards')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class CardStatementController {
  constructor(private readonly statementService: StatementService) {}

  @Post(':cardId/statements')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and parse a credit card statement' })
  async uploadStatement(
    @Param('cardId') cardId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.statementService.uploadAndParse(cardId, circleId, file);
  }
}