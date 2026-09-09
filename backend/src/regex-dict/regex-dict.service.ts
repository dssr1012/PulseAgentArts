import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { CreateNotificationPatternDto, UpdateNotificationPatternDto } from './dto/regex-dict.dto';

@Injectable()
export class RegexDictService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createPattern(dto: CreateNotificationPatternDto) {
    // Get current max version
    const maxVersionPattern = await this.prisma.notificationPattern.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const newVersion = (maxVersionPattern?.version || 0) + 1;

    const pattern = await this.prisma.notificationPattern.create({
      data: {
        appName: dto.appName,
        regexPattern: dto.regexPattern,
        version: newVersion,
        fieldsExtracted: JSON.stringify(dto.fieldsExtracted),
      },
    });

    // Invalidate Redis cache
    await this.redis.del('regex:dict:latest');

    return {
      id: pattern.id,
      appName: pattern.appName,
      regexPattern: pattern.regexPattern,
      version: pattern.version,
      fieldsExtracted: JSON.parse(pattern.fieldsExtracted),
      createdAt: pattern.createdAt,
    };
  }

  async updatePattern(patternId: string, dto: UpdateNotificationPatternDto) {
    const existing = await this.prisma.notificationPattern.findUnique({
      where: { id: patternId },
    });

    if (!existing) {
      throw new NotFoundException({
        errorCode: 'PATTERN_NOT_FOUND',
        message: 'Notification pattern not found',
      });
    }

    // Get current max version
    const maxVersionPattern = await this.prisma.notificationPattern.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const newVersion = (maxVersionPattern?.version || 0) + 1;

    const updateData: any = { version: newVersion };
    if (dto.appName) updateData.appName = dto.appName;
    if (dto.regexPattern) updateData.regexPattern = dto.regexPattern;
    if (dto.fieldsExtracted) updateData.fieldsExtracted = JSON.stringify(dto.fieldsExtracted);

    const pattern = await this.prisma.notificationPattern.update({
      where: { id: patternId },
      data: updateData,
    });

    // Invalidate Redis cache
    await this.redis.del('regex:dict:latest');

    return {
      id: pattern.id,
      appName: pattern.appName,
      regexPattern: pattern.regexPattern,
      version: pattern.version,
      fieldsExtracted: JSON.parse(pattern.fieldsExtracted),
      createdAt: pattern.createdAt,
    };
  }

  async deletePattern(patternId: string) {
    const existing = await this.prisma.notificationPattern.findUnique({
      where: { id: patternId },
    });

    if (!existing) {
      throw new NotFoundException({
        errorCode: 'PATTERN_NOT_FOUND',
        message: 'Notification pattern not found',
      });
    }

    await this.prisma.notificationPattern.delete({ where: { id: patternId } });
    await this.redis.del('regex:dict:latest');
  }

  async getDictionary(version?: number) {
    // Try Redis cache first
    const cacheKey = version ? `regex:dict:v${version}` : 'regex:dict:latest';
    const cached = await this.redis.getJSON<any>(cacheKey);
    if (cached) return cached;

    let patterns;

    if (version) {
      // Get all patterns at or before the specified version
      patterns = await this.prisma.notificationPattern.findMany({
        where: { version: { lte: version } },
        orderBy: { version: 'desc' },
      });
    } else {
      // Get latest version
      const maxVersionPattern = await this.prisma.notificationPattern.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      if (!maxVersionPattern) {
        return { version: 0, patterns: [] };
      }

      patterns = await this.prisma.notificationPattern.findMany({
        where: { version: maxVersionPattern.version },
      });
    }

    const result = {
      version: patterns.length > 0 ? patterns[0].version : 0,
      patterns: patterns.map((p) => ({
        appName: p.appName,
        pattern: p.regexPattern,
        fieldsExtracted: JSON.parse(p.fieldsExtracted),
      })),
    };

    // Cache for 1 hour
    await this.redis.setJSON(cacheKey, result, 3600);

    return result;
  }

  async listPatterns() {
    const patterns = await this.prisma.notificationPattern.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return patterns.map((p) => ({
      id: p.id,
      appName: p.appName,
      regexPattern: p.regexPattern,
      version: p.version,
      fieldsExtracted: JSON.parse(p.fieldsExtracted),
      createdAt: p.createdAt,
    }));
  }
}