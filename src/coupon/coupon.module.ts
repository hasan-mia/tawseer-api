/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { RedisCacheService } from '@/rediscloud.service';
import { CouponSchema } from '@/schemas/coupon.schema';
import { ServiceSchema } from '@/schemas/service.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../schemas/user.schema';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'Coupon', schema: CouponSchema },
    ]),
  ],
  controllers: [CouponController],
  providers: [CouponService, CloudinaryService, RedisCacheService],
  exports: [CouponService],
})
export class CouponModule { }
