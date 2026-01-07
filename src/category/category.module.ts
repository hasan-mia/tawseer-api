import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { CategorySchema } from '@/schemas/category.schema'; // Import Category Schema
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
  providers: [CategoryService, CloudinaryService],
  exports: [CategoryService],
})
export class CategoryModule { }
