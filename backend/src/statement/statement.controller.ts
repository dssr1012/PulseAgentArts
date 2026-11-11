import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StatementService } from './statement.service';
import { AcceptItemsDto, ReportFraudDto } from './dto/statement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CircleMembershipGuard } from '../auth/guards/circle-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Statements')
@Controller('statements')
@UseGuards(JwtAuthGuard, CircleMembershipGuard)
@ApiBearerAuth()
export class StatementController {
  constructor(private readonly statementService: StatementService) {}

  @Get(':previewId/reconcile')
  @ApiOperation({ summary: 'Cross-reference statement items against existing expenses' })
  async reconcileStatement(
    @Param('previewId') previewId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.statementService.reconcileStatement(previewId, circleId);
  }

  @Post(':previewId/accept')
  @ApiOperation({ summary: 'Accept selected statement items as card expenses' })
  async acceptItems(
    @Param('previewId') previewId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
    @Body() dto: AcceptItemsDto,
  ) {
    return this.statementService.acceptItems(previewId, userId, circleId, dto);
  }

  @Post(':previewId/fraud')
  @ApiOperation({ summary: 'Report statement items as fraudulent charges' })
  async reportFraud(
    @Param('previewId') previewId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('circleId') circleId: string,
    @Body() dto: ReportFraudDto,
  ) {
    return this.statementService.reportFraud(previewId, userId, circleId, dto);
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
    @Body('password') password: string | undefined,
  ) {
    return this.statementService.uploadAndParse(cardId, circleId, file, password);
  }

  @Get(':cardId/statements')
  @ApiOperation({ summary: 'List statements for a credit card' })
  async listStatements(
    @Param('cardId') cardId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.statementService.listStatements(cardId, circleId);
  }
}
