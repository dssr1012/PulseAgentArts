import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Request } from 'express';

/**
 * Guard that validates the user's circle membership in the database.
 * Reads the active circle from the X-Circle-Id header (or falls back to the
 * first membership from the JWT). Verifies the user is still a member of
 * that circle in the DB, then sets circleId/role on request.user.
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

    // Determine the active circle: X-Circle-Id header > JWT circleId > first from DB
    const headerCircleId = request.headers['x-circle-id'] as string | undefined;
    const targetCircleId = headerCircleId || user.circleId || null;

    // Fetch all memberships for the user
    const memberships = await this.prisma.familyGroupMember.findMany({
      where: { userId: user.id },
    });

    if (memberships.length === 0) {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_NOT_FOUND',
        message: 'You are not a member of any Family Circle',
      });
    }

    // If a specific circle was requested, verify membership
    let activeMembership;
    if (targetCircleId) {
      activeMembership = memberships.find((m) => m.groupId === targetCircleId);
    }
    if (!activeMembership) {
      // Fall back to first membership
      activeMembership = memberships[0];
    }

    // Update request.user with fresh membership data from DB
    request.user = {
      ...user,
      circleId: activeMembership.groupId,
      role: activeMembership.role,
      circles: memberships.map((m) => ({ id: m.groupId, role: m.role })),
    };

    return true;
  }
}
