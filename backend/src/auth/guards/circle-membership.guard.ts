import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Request } from 'express';

/**
 * Guard that validates the user's current circle membership in the database.
 * This prevents stale JWT claims from granting access to circle-scoped resources
 * after a user has been removed from a circle.
 */
@Injectable()
export class CircleMembershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    if (!user?.id) {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'You do not have permission to perform this action',
      });
    }

    // Verify current membership in the database (not just from JWT)
    const membership = await this.prisma.familyGroupMember.findUnique({
      where: { userId: user.id },
    });

    if (!membership) {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_NOT_FOUND',
        message: 'You are no longer a member of a Family Circle',
      });
    }

    // Update request.user with fresh membership data from DB
    request.user = {
      ...user,
      circleId: membership.groupId,
      role: membership.role,
    };

    return true;
  }
}