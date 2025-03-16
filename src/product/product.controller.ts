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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdateProductDto } from './dto/product.dto';
import { CreateProductWithVariantsDto, ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(
    private productService: ProductService,
  ) { }

  // ======== Update Product ========
  @Post('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor')
  @HttpCode(HttpStatus.CREATED)
  async createProductWithVariants(
    @Body() data: CreateProductWithVariantsDto, @Request() req
  ) {
    const user = req.user;
    return this.productService.createProductWithVariants(user.id, data);

  }

  // ======== Update Product ========
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async updateProductWithVariants(
    @Body() data: UpdateProductDto, @Request() req
  ) {
    const user = req.user;
    const productId = req.params.id;
    return this.productService.updateProductWithVariants(user.id, productId, data);

  }

  // ======== Get Product info by id ========
  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  async getProductWithVariants(@Param('slug') slug: string) {
    return this.productService.getProductWithVariants(slug);
  }

  // ======== Get Product info by id ========
  @Get('')
  @HttpCode(HttpStatus.OK)
  async getAllProductsWithVariants(@Request() req) {
    return this.productService.getAllProductsWithVariants(req);
  }

  // ======== Delete Product info by id ========

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
  @HttpCode(HttpStatus.OK)
  async deleteProductWithVariants(@Param('id') id: string, @Request() req) {
    const user = req.user;
    return this.productService.deleteProductWithVariants(id);
  }

}
