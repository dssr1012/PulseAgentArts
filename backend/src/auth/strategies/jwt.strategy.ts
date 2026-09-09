import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JwtStrategy.resolveSecret(config),
      passReqToCallback: false,
    });
  }

  private static resolveSecret(config: ConfigService): string {
    const publicKeyPath = config.get<string>('JWT_PUBLIC_KEY_PATH');
    if (publicKeyPath) {
      const key = readFileSync(publicKeyPath);
      if (key) return key;
    }

    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      if (config.get<string>('NODE_ENV') === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
      }
      new Logger('JwtStrategy').warn('JWT_SECRET is not set. Using insecure default. Do NOT use in production!');
      return 'pulse-expends-dev-secret';
    }
    return secret;
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { circleMembership: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: 'AUTH_INVALID_TOKEN',
        message: 'User not found',
      });
    }

    return {
      id: user.id,
      email: user.email,
      givenName: user.givenName,
      circleId: user.circleMembership?.groupId || null,
      role: user.circleMembership?.role || null,
    };
  }
}

function readFileSync(path: string): string | null {
  try {
    const fs = require('fs');
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}