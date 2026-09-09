import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const SetRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);