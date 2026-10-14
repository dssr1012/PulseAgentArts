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
    const { key, algorithm } = JwtStrategy.resolveKey(config);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: key,
      algorithms: algorithm ? [algorithm] : undefined,
      passReqToCallback: false,
    });
  }

  private static resolveKey(config: ConfigService): { key: string; algorithm?: string } {
    const publicKeyPath = config.get<string>('JWT_PUBLIC_KEY_PATH');
    if (publicKeyPath) {
      const key = readFileSync(publicKeyPath);
      if (key) return { key, algorithm: 'RS256' };
    }

    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is required (or set JWT_PUBLIC_KEY_PATH for RSA keys). ' +
        'Copy .env.example to .env and configure your secrets.',
      );
    }
    return { key: secret };
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { circleMemberships: { include: { group: true } } },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: 'AUTH_INVALID_TOKEN',
        message: 'User not found',
      });
    }

    const circles = user.circleMemberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      role: m.role,
    }));

    return {
      id: user.id,
      email: user.email,
      givenName: user.givenName,
      circleId: circles.length > 0 ? circles[0].id : null,
      role: circles.length > 0 ? circles[0].role : null,
      circles,
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