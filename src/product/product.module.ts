/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { ProductSchema } from '@/schemas/product.schema';
import { ReviewSchema } from '@/schemas/review.schema';
import { VariantSchema } from '@/schemas/variant.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { VendorSchema } from 'src/schemas/vendor.schema';
import { UserSchema } from '../schemas/user.schema';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'Product', schema: ProductSchema },
      { name: 'Variant', schema: VariantSchema },
      { name: 'Review', schema: ReviewSchema },
    ]),
  ],
  controllers: [ProductController],
  providers: [ProductService, CloudinaryService, RedisCacheService],
  exports: [ProductService],
})
export class ProductModule { }
