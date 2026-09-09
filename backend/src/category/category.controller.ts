import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories for your circle' })
  async listCategories(@CurrentUser('circleId') circleId: string) {
    return this.categoryService.listCategories(circleId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom category' })
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.categoryService.createCategory(circleId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom category' })
  async deleteCategory(
    @Param('id') categoryId: string,
    @CurrentUser('circleId') circleId: string,
  ) {
    return this.categoryService.deleteCategory(categoryId, circleId);
  }
}

