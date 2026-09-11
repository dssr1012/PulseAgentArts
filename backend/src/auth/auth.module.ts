import { Module, Global, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CircleMembershipGuard } from './guards/circle-membership.guard';

const logger = new Logger('AuthModule');

// Google OAuth2 SSO is optional: only register GoogleStrategy when credentials are configured
const googleProviders = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? [GoogleStrategy]
  : [];

if (googleProviders.length === 0) {
  logger.warn('Google OAuth2 SSO is disabled: GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET are not set.');
}

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKeyPath = config.get<string>('JWT_PRIVATE_KEY_PATH');
        const privateKey = privateKeyPath ? readKeyFile(privateKeyPath) : null;
        if (privateKey) {
          return {
            privateKey,
            signOptions: {
              algorithm: 'RS256',
              expiresIn: config.get<string>('JWT_ACCESS_TTL', '24h'),
              issuer: config.get<string>('JWT_ISSUER', 'pulseexpends'),
            },
          };
        }

        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          if (config.get<string>('NODE_ENV') === 'production') {
            throw new Error('JWT_SECRET environment variable is required in production');
          }
          logger.warn('JWT_SECRET is not set. Using insecure default. Do NOT use in production!');
        }
        return {
          secret: secret || 'pulse-expends-dev-secret',
          signOptions: {
            expiresIn: config.get<string>('JWT_ACCESS_TTL', '24h'),
            issuer: config.get<string>('JWT_ISSUER', 'pulseexpends'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, CircleMembershipGuard, ...googleProviders],
  exports: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, CircleMembershipGuard, JwtModule, ...googleProviders],
})
export class AuthModule {}

function readKeyFile(path: string): string | null {
  try {
    return require('fs').readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}