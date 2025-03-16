import { RedisCacheService } from '@/rediscloud.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CategorySchema } from 'src/schemas/category.schema'; // Import Category Schema
import { VendorSchema } from 'src/schemas/vendor.schema';
import { UserSchema } from '../schemas/user.schema';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'Category', schema: CategorySchema },
    ]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService, CloudinaryService, RedisCacheService],
  exports: [CategoryService],
})
export class CategoryModule { }
