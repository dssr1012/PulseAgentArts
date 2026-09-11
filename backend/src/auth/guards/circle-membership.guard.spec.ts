import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { CircleMembershipGuard } from './circle-membership.guard';
import { PrismaService } from '../../common/prisma.service';

describe('CircleMembershipGuard', () => {
  let guard: CircleMembershipGuard;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircleMembershipGuard,
        {
          provide: PrismaService,
          useValue: {
            familyGroupMember: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<CircleMembershipGuard>(CircleMembershipGuard);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockContext(user?: any): ExecutionContext {
    const request: any = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => CircleMembershipGuard,
    } as any;
  }

  it('should throw ForbiddenException when user is not set on request', async () => {
    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user.id is missing', async () => {
    const context = createMockContext({ email: 'test@example.com' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is no longer a member', async () => {
    (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(null);
    const context = createMockContext({ id: 'user-1', circleId: 'circle-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should refresh request.user with membership data from DB and allow access', async () => {
    const membership = { userId: 'user-1', groupId: 'circle-2', role: 'admin' };
    (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(membership);

    const context = createMockContext({ id: 'user-1', circleId: 'old-circle', role: 'member' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user.circleId).toBe('circle-2');
    expect(request.user.role).toBe('admin');
    expect(request.user.id).toBe('user-1');
  });

  it('should look up membership by user.id', async () => {
    const membership = { userId: 'user-1', groupId: 'circle-1', role: 'member' };
    (prisma.familyGroupMember.findUnique as jest.Mock).mockResolvedValue(membership);

    const context = createMockContext({ id: 'user-1' });

    await guard.canActivate(context);

    expect(prisma.familyGroupMember.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });
});
