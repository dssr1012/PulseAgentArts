import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../common/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'JWT_PUBLIC_KEY_PATH') return './keys/public.pem';
              return def;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user object with circleId and role when user exists', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        givenName: 'Test User',
        circleMembership: { groupId: 'circle-1', role: 'admin' },
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await strategy.validate({ sub: 'user-1', email: 'test@example.com' });

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.givenName).toBe('Test User');
      expect(result.circleId).toBe('circle-1');
      expect(result.role).toBe('admin');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'nonexistent', email: 'nobody@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return null circleId and role when user has no membership', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        givenName: 'Test User',
        circleMembership: null,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await strategy.validate({ sub: 'user-1' });

      expect(result.circleId).toBeNull();
      expect(result.role).toBeNull();
    });

    it('should look up user by payload.sub with circleMembership included', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        givenName: 'Test',
        circleMembership: { groupId: 'circle-1', role: 'member' },
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await strategy.validate({ sub: 'user-1' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { circleMembership: true },
      });
    });
  });
});
