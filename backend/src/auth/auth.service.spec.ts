import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  LockedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

// Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$v=19$m=65536$t=3$p=abc$hash'),
  verify: jest.fn(),
  argon2id: 2,
}));

// Mock crypto
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('a'.repeat(64), 'hex')),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;
  let jwtService: jest.Mocked<JwtService>;
  let config: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536$t=3$p=abc$hash',
    givenName: 'Test User',
    pictureUrl: null,
    authProvider: 'traditional',
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  const mockMembership = {
    userId: 'user-1',
    groupId: 'circle-1',
    role: 'admin',
    joinedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            refreshToken: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            familyGroupMember: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: RedisService,
          useValue: {
            del: jest.fn().mockResolvedValue(undefined),
            setJSON: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                ARGON2_TIME_COST: 3,
                ARGON2_MEMORY_COST: 65536,
                ARGON2_PARALLELISM: 4,
                JWT_ACCESS_TTL: '24h',
                JWT_REFRESH_TTL: '7d',
                ACCOUNT_LOCKOUT_THRESHOLD: 5,
                ACCOUNT_LOCKOUT_DURATION_MINUTES: 30,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    jwtService = module.get(JwtService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Registration ────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'Password123',
      givenName: 'New User',
    };

    it('should register a new user and return tokens', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        givenName: registerDto.givenName,
      });
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerDto.email,
            givenName: registerDto.givenName,
            authProvider: 'traditional',
          }),
        }),
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ errorCode: 'AUTH_EMAIL_EXISTS' }),
        }),
      );
    });

    it('should hash password with argon2 before storing', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);

      await service.register(registerDto);

      expect(argon2.hash).toHaveBeenCalledWith(
        registerDto.password,
        expect.objectContaining({ type: argon2.argon2id }),
      );
    });
  });

  // ─── Login ───────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123',
    };

    it('should login with valid credentials and return tokens', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0 }),
        }),
      );
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException without revealing whether email or password is wrong', async () => {
      // Non-existent user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      try {
        await service.login({ email: 'no@user.com', password: 'wrong' });
      } catch (e: any) {
        expect(e.response.errorCode).toBe('AUTH_INVALID_CREDENTIALS');
      }

      // Wrong password
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      try {
        await service.login(loginDto);
      } catch (e: any) {
        expect(e.response.errorCode).toBe('AUTH_INVALID_CREDENTIALS');
      }
    });

    it('should throw LockedException when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min in future
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(lockedUser);

      await expect(service.login(loginDto)).rejects.toThrow(LockedException);
    });

    it('should reset lockout counter after lockout period expires', async () => {
      const expiredLockUser = {
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // expired
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(expiredLockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      await service.login(loginDto);

      // Should have called update to reset lockout
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });

    it('should increment failed login attempts on wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 2,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      try {
        await service.login(loginDto);
      } catch {}

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 3 }),
        }),
      );
    });

    it('should lock account after 5 consecutive failed attempts', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 4,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      try {
        await service.login(loginDto);
      } catch {}

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── Token Refresh ───────────────────────────────────────────────

  describe('refresh', () => {
    it('should issue new token pair for valid refresh token', async () => {
      const storedToken = {
        id: 'rt-1',
        tokenHash: 'some-hash',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(storedToken);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      const result = await service.refresh({ refreshToken: 'valid-refresh-token' });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isRevoked: true },
        }),
      );
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      const storedToken = {
        id: 'rt-1',
        tokenHash: 'some-hash',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user: mockUser,
      };
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(storedToken);

      await expect(
        service.refresh({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const storedToken = {
        id: 'rt-1',
        tokenHash: 'some-hash',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000), // expired
        user: mockUser,
      };
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(storedToken);

      await expect(
        service.refresh({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'nonexistent-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke refresh token and clear Redis session', async () => {
      await service.logout('user-1', 'some-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('session:user-1');
    });

    it('should clear Redis session even without refresh token', async () => {
      await service.logout('user-1');

      expect(redis.del).toHaveBeenCalledWith('session:user-1');
    });
  });

  // ─── Google SSO ──────────────────────────────────────────────────

  describe('validateGoogleUser', () => {
    const googleProfile = {
      email: 'google@example.com',
      givenName: 'Google User',
      pictureUrl: 'https://photo.url/pic.jpg',
    };

    it('should auto-provision new Google user when email not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'new-google-user',
        email: googleProfile.email,
        givenName: googleProfile.givenName,
        pictureUrl: googleProfile.pictureUrl,
        authProvider: 'google_sso',
      });
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateGoogleUser(googleProfile);

      expect(result.accessToken).toBe('mock-access-token');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: googleProfile.email,
            authProvider: 'google_sso',
          }),
        }),
      );
    });

    it('should authenticate existing user when Google email found', async () => {
      const existingUser = {
        ...mockUser,
        email: googleProfile.email,
        authProvider: 'google_sso',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      const result = await service.validateGoogleUser(googleProfile);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe(googleProfile.email);
      // Should NOT create a new user
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should upgrade traditional user to hybrid auth provider', async () => {
      const traditionalUser = {
        ...mockUser,
        email: googleProfile.email,
        authProvider: 'traditional',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(traditionalUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...traditionalUser,
        authProvider: 'hybrid',
        pictureUrl: googleProfile.pictureUrl,
      });
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      const result = await service.validateGoogleUser(googleProfile);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authProvider: 'hybrid',
          }),
        }),
      );
    });
  });

  // ─── JWT Token Generation ────────────────────────────────────────

  describe('generateTokenPair (via register)', () => {
    it('should include circleId and role in JWT payload', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      await service.register({
        email: 'new@example.com',
        password: 'Password123',
        givenName: 'New User',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          circleId: mockMembership.groupId,
          role: mockMembership.role,
        }),
        expect.any(Object),
      );
    });

    it('should use 24h as default access token TTL', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);

      await service.register({
        email: 'new@example.com',
        password: 'Password123',
        givenName: 'New User',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '24h' }),
      );
    });
  });

  // ─── validateUserById ────────────────────────────────────────────

  describe('validateUserById', () => {
    it('should return user with circle membership', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        circleMembership: mockMembership,
      });

      const result = await service.validateUserById('user-1');

      expect(result).toBeDefined();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { circleMembership: true },
      });
    });
  });
});