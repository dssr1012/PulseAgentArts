import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async listCategories(circleId: string) {
    return this.prisma.category.findMany({
      where: { groupId: circleId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createCategory(circleId: string, dto: CreateCategoryDto) {
    // Check for duplicate name
    const existing = await this.prisma.category.findFirst({
      where: { groupId: circleId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException({
        errorCode: 'CATEGORY_DUPLICATE',
        message: 'A category with this name already exists in your circle',
      });
    }

    return this.prisma.category.create({
      data: {
        groupId: circleId,
        name: dto.name,
        icon: dto.icon,
        isDefault: false,
      },
    });
  }

  async deleteCategory(categoryId: string, circleId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.groupId !== circleId) {
      throw new NotFoundException({
        errorCode: 'CATEGORY_NOT_FOUND',
        message: 'Category not found',
      });
    }

    if (category.isDefault) {
      throw new ForbiddenException({
        errorCode: 'CATEGORY_IS_DEFAULT',
        message: 'Default categories cannot be deleted',
      });
    }

    // Check if category is in use
    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId },
    });

    if (transactionCount > 0) {
      throw new ConflictException({
        errorCode: 'CATEGORY_IN_USE',
        message: 'Cannot delete a category that is referenced by expenses',
      });
    }

    await this.prisma.category.delete({ where: { id: categoryId } });
  }
}