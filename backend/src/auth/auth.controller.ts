import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, ExchangeAuthCodeDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IsPublic } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RedisService } from '../common/redis.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly redis: RedisService,
  ) {}

  @Post('register')
  @IsPublic()
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('login')
  @IsPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @IsPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new BadRequestException({
        errorCode: 'AUTH_REFRESH_INVALID',
        message: 'Refresh token not found',
      });
    }
    const result = await this.authService.refresh({ refreshToken });
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Get('google')
  @IsPublic()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 flow' })
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @IsPublic()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = req.user as any;

    // Generate a short-lived one-time authorization code
    const authCode = crypto.randomBytes(32).toString('hex');

    // Store tokens in Redis with 30s TTL
    await this.redis.setJSON(
      `auth:code:${authCode}`,
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      30, // 30 seconds TTL
    );

    // Redirect to frontend with only the auth code in the URL
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback?code=${authCode}`;
    res.redirect(redirectUrl);
  }

  @Post('exchange')
  @IsPublic()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange one-time auth code for tokens' })
  async exchangeCode(@Body() dto: ExchangeAuthCodeDto, @Res({ passthrough: true }) res: Response) {
    const stored = await this.redis.getJSON<{ accessToken: string; refreshToken: string }>(
      `auth:code:${dto.code}`,
    );

    if (!stored) {
      throw new BadRequestException({
        errorCode: 'AUTH_CODE_INVALID',
        message: 'Invalid or expired authorization code',
      });
    }

    // Delete the code immediately (one-time use)
    await this.redis.del(`auth:code:${dto.code}`);

    // Set refresh token as HttpOnly cookie
    this.setRefreshTokenCookie(res, stored.refreshToken);

    return { accessToken: stored.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and revoke tokens' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    await this.authService.logout(userId, refreshToken);
    this.clearRefreshTokenCookie(res);
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth',
      maxAge: 0,
    });
  }
}