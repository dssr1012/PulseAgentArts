import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../../common/prisma.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockContext(user?: any): ExecutionContext {
    const request: any = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => RolesGuard,
    } as any;
  }

  it('should allow access when no roles are required', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when required roles array is empty', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user is not set on request', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['admin']);
    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when admin role is required and user is admin', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['admin']);
    const context = createMockContext({ id: 'user-1', role: 'admin' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when admin role is required but user is not admin', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['admin']);
    const context = createMockContext({ id: 'user-1', role: 'member' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
