import { Module, Logger } from '@nestjs/common';
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

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
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
  providers: [AuthService, JwtStrategy, GoogleStrategy, JwtAuthGuard, RolesGuard, CircleMembershipGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, CircleMembershipGuard, JwtModule],
})
export class AuthModule {}