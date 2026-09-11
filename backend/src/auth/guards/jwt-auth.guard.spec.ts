import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../common/decorators/roles.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'JWT_PUBLIC_KEY_PATH') return './keys/public.pem';
              return def;
            }),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get(Reflector);
    jwtService = module.get(JwtService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockContext(headers: any = {}, user?: any): ExecutionContext {
    const request: any = { headers, user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => JwtAuthGuard,
    } as any;
  }

  it('should allow access to public routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when no token is provided', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for an invalid Bearer token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('jwt malformed'));

    const context = createMockContext({ authorization: 'Bearer invalid-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should set request.user with id from payload.sub on valid token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const payload = { sub: 'user-1', email: 'test@example.com', circleId: 'circle-1', role: 'admin' };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    const context = createMockContext({ authorization: 'Bearer valid-token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user.id).toBe('user-1');
    expect(request.user.email).toBe('test@example.com');
    expect(request.user.sub).toBe('user-1');
  });

  it('should throw UnauthorizedException when authorization header has wrong type', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const context = createMockContext({ authorization: 'Basic some-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
