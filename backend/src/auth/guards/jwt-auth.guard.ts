import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/roles.decorator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        errorCode: 'AUTH_REQUIRED',
        message: 'Authentication token is required',
      });
    }

    try {
      const secret = this.getSecret();

      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      request['user'] = payload;
    } catch {
      throw new UnauthorizedException({
        errorCode: 'AUTH_INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
      });
    }

    return true;
  }

  private getSecret(): string {
    const publicKeyPath = this.config.get<string>('JWT_PUBLIC_KEY_PATH');
    if (publicKeyPath) {
      const key = this.readFile(publicKeyPath);
      if (key) return key;
    }

    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
      }
      this.logger.warn('JWT_SECRET is not set. Using insecure default. Do NOT use in production!');
      return 'pulse-expends-dev-secret';
    }
    return secret;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private readFile(path: string): string | null {
    try {
      const fs = require('fs');
      return fs.readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  }
}