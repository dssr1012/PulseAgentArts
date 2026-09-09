import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { RegisterDto, LoginDto, RefreshDto, AuthResponseDto, UserResponseDto } from './dto/auth.dto';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException({
        errorCode: 'AUTH_EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      timeCost: this.config.get<number>('ARGON2_TIME_COST', 3),
      memoryCost: this.config.get<number>('ARGON2_MEMORY_COST', 65536),
      parallelism: this.config.get<number>('ARGON2_PARALLELISM', 4),
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        givenName: dto.givenName,
        authProvider: 'traditional',
      },
    });

    const { accessToken, refreshToken } = await this.generateTokenPair(user);

    return {
      accessToken,
      refreshToken,
      user: await this.buildUserResponse(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        {
          errorCode: 'AUTH_ACCOUNT_LOCKED',
          message: 'Account temporarily locked. Try again later.',
        },
        423,
      );
    }

    // If lockout period expired, reset counter
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Verify password
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException({
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const { accessToken, refreshToken } = await this.generateTokenPair(user);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken,
      refreshToken,
      user: await this.buildUserResponse(user),
    };
  }

  async refresh(dto: RefreshDto): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException({
        errorCode: 'AUTH_REFRESH_INVALID',
        message: 'Invalid or expired refresh token',
      });
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Generate new token pair
    const { accessToken, refreshToken } = await this.generateTokenPair(storedToken.user);

    return { accessToken, refreshToken };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { isRevoked: true },
      });
    }

    // Clear Redis session
    await this.redis.del(`session:${userId}`);
  }

  async validateGoogleUser(googleProfile: {
    email: string;
    givenName: string;
    pictureUrl?: string;
  }): Promise<AuthResponseDto> {
    let user = await this.prisma.user.findUnique({
      where: { email: googleProfile.email },
    });

    if (!user) {
      // Auto-provision new Google user
      user = await this.prisma.user.create({
        data: {
          email: googleProfile.email,
          givenName: googleProfile.givenName,
          pictureUrl: googleProfile.pictureUrl,
          authProvider: 'google_sso',
        },
      });
      this.logger.log(`Auto-provisioned Google user: ${user.email}`);
    } else if (user.authProvider === 'traditional') {
      // Upgrade to hybrid
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          authProvider: 'hybrid',
          pictureUrl: googleProfile.pictureUrl || user.pictureUrl,
        },
      });
    }

    const { accessToken, refreshToken } = await this.generateTokenPair(user);

    return {
      accessToken,
      refreshToken,
      user: await this.buildUserResponse(user),
    };
  }

  async validateUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { circleMembership: true },
    });
  }

  private async handleFailedLogin(user: any): Promise<void> {
    const newAttempts = user.failedLoginAttempts + 1;
    const lockoutThreshold = this.config.get<number>('ACCOUNT_LOCKOUT_THRESHOLD', 5);
    const lockoutDuration = this.config.get<number>('ACCOUNT_LOCKOUT_DURATION_MINUTES', 30);

    if (newAttempts >= lockoutThreshold) {
      const lockedUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newAttempts, lockedUntil },
      });
      this.logger.warn(`Account locked: ${user.email}`);
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newAttempts },
      });
    }
  }

  private async generateTokenPair(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId: user.id },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      circleId: membership?.groupId || null,
      role: membership?.role || null,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_TTL', '24h'),
    });

    // Generate opaque refresh token
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const refreshTtl = this.config.get('JWT_REFRESH_TTL', '7d');
    const refreshTtlMs = this.parseTtlToMs(refreshTtl);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    // Cache session in Redis
    await this.redis.setJSON(
      `session:${user.id}`,
      { userId: user.id, circleId: membership?.groupId || null },
      86400, // 24h
    );

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private async buildUserResponse(user: any): Promise<UserResponseDto> {
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId: user.id },
    });

    return {
      id: user.id,
      email: user.email,
      givenName: user.givenName,
      pictureUrl: user.pictureUrl,
      authProvider: user.authProvider,
      circleId: membership?.groupId || null,
      role: membership?.role || null,
    };
  }

  private parseTtlToMs(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }
}