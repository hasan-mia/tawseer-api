/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards
} from '@nestjs/common';

import { RolesGuard } from '@/auth/role.guard';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CategoryService } from './category.service';
import { CategoryDto } from './dto/category.dto';

@Controller('categories')
export class CategoryController {
  constructor(
    private categoryService: CategoryService,
  ) { }

  // ======== Update Category ========
  @Post('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() data: CategoryDto, @Request() req) {
    return this.categoryService.createCategory(data);

  }

  // ======== Update Category ========
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async updateCategory(@Param('id') id: string, @Body() data: CategoryDto, @Request() req) {
    return this.categoryService.updateCategory(id, data);

  }

  // ======== Get all Category ========
  @Get('')
  @HttpCode(HttpStatus.OK)
  async getAllCategories(@Request() req) {
    return this.categoryService.getAllCategories();
  }


  // ======== Delete Category by id ========
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('id') id: string) {
    return this.categoryService.deleteCategory(id);
  }


}
