import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from 'src/schemas/category.schema';
import { CategoryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<Category>,
  ) { }

  // ======== Create new Category ========
  async createCategory(data: CategoryDto) {
    try {
      const { name, parentCategory, image } = data;

      const existCategory = await this.categoryModel.findOne({ name }).exec();
      if (existCategory) {
        throw new BadRequestException('Category already exists');
      }

      const newCategory = new this.categoryModel({
        name,
        parentCategory,
        image,
      });

      const savedCategory = await newCategory.save();

      return {
        success: true,
        message: 'Category created successfully',
        data: savedCategory,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Get All Categories ========
  async getAllCategories() {
    try {
      const categories = await this.categoryModel.find().exec();

      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Update Category ========
  async updateCategory(id: string, data: CategoryDto) {
    try {
      const category = await this.categoryModel.findByIdAndUpdate(id, data, { new: true }).exec();

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return {
        success: true,
        message: 'Category updated successfully',
        data: category,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Delete Category ========
  async deleteCategory(id: string) {
    try {
      const category = await this.categoryModel.findByIdAndDelete(id).exec();

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return {
        success: true,
        message: 'Category deleted successfully',
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }
}
