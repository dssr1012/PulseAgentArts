import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'You do not have permission to perform this action',
      });
    }

    // Check if user has the required role
    if (requiredRoles.includes('admin') && user.role !== 'admin') {
      throw new ForbiddenException({
        errorCode: 'CIRCLE_PERMISSION_DENIED',
        message: 'Only circle administrators can perform this action',
      });
    }

    return true;
  }
}