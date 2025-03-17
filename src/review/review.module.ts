/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { RedisCacheService } from '@/rediscloud.service';
import { ProductSchema } from '@/schemas/product.schema';
import { ReviewSchema } from '@/schemas/review.schema';
import { ServiceSchema } from '@/schemas/service.schema';
import { UserSchema } from '@/schemas/user.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'Review', schema: ReviewSchema },
      { name: 'Product', schema: ProductSchema },
    ]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService, CloudinaryService, RedisCacheService],
  exports: [ReviewService],
})
export class ReviewModule { }
