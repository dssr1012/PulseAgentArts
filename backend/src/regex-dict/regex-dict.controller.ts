import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RegexDictService } from './regex-dict.service';
import { CreateNotificationPatternDto, UpdateNotificationPatternDto } from './dto/regex-dict.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class DictionaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  version?: number;
}

@ApiTags('Regex Dictionary')
@Controller('regex-dictionary')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RegexDictController {
  constructor(private readonly regexDictService: RegexDictService) {}

  @Get()
  @ApiOperation({ summary: 'Download versioned regex pattern dictionary' })
  async getDictionary(@Query() query: DictionaryQueryDto) {
    return this.regexDictService.getDictionary(query.version);
  }

  @Get('patterns')
  @ApiOperation({ summary: 'List all notification patterns (admin)' })
  async listPatterns() {
    return this.regexDictService.listPatterns();
  }

  @Post('patterns')
  @ApiOperation({ summary: 'Create a notification pattern (admin)' })
  async createPattern(@Body() dto: CreateNotificationPatternDto) {
    return this.regexDictService.createPattern(dto);
  }

  @Delete('patterns/:id')
  @ApiOperation({ summary: 'Delete a notification pattern (admin)' })
  async deletePattern(@Param('id') patternId: string) {
    return this.regexDictService.deletePattern(patternId);
  }
}