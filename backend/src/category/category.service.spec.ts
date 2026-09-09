import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { PrismaService } from '../common/prisma.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let prisma: jest.Mocked<PrismaService>;

  const mockDefaultCategory = {
    id: 'cat-1',
    groupId: 'circle-1',
    name: 'Alimentación',
    icon: '🍽️',
    isDefault: true,
    createdAt: new Date(),
  };

  const mockCustomCategory = {
    id: 'cat-5',
    groupId: 'circle-1',
    name: 'Education',
    icon: '📚',
    isDefault: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            transaction: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── List Categories ─────────────────────────────────────────────

  describe('listCategories', () => {
    it('should return all categories for a circle', async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValue([
        mockDefaultCategory,
        mockCustomCategory,
      ]);

      const result = await service.listCategories('circle-1');

      expect(result).toHaveLength(2);
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'circle-1' },
        }),
      );
    });

    it('should order default categories first, then alphabetically', async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);

      await service.listCategories('circle-1');

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        }),
      );
    });
  });

  // ─── Create Category ─────────────────────────────────────────────

  describe('createCategory', () => {
    it('should create a custom category', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue(mockCustomCategory);

      const result = await service.createCategory('circle-1', {
        name: 'Education',
        icon: '📚',
      });

      expect(result.name).toBe('Education');
      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Education',
            isDefault: false,
          }),
        }),
      );
    });

    it('should throw ConflictException for duplicate category name', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCustomCategory);

      await expect(
        service.createCategory('circle-1', { name: 'Education' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should always set isDefault to false for custom categories', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue(mockCustomCategory);

      await service.createCategory('circle-1', { name: 'NewCat' });

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: false }),
        }),
      );
    });
  });

  // ─── Delete Category ─────────────────────────────────────────────

  describe('deleteCategory', () => {
    it('should delete a custom category not in use', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(mockCustomCategory);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
      (prisma.category.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteCategory('cat-5', 'circle-1');

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-5' },
      });
    });

    it('should throw ForbiddenException for default category deletion', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(mockDefaultCategory);

      await expect(
        service.deleteCategory('cat-1', 'circle-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for category in use by expenses', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(mockCustomCategory);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(5);

      await expect(
        service.deleteCategory('cat-5', 'circle-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent category', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteCategory('cat-99', 'circle-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for category from different circle', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        ...mockCustomCategory,
        groupId: 'circle-2',
      });

      await expect(
        service.deleteCategory('cat-5', 'circle-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});