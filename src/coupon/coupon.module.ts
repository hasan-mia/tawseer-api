/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CouponSchema } from 'src/schemas/coupon.schema';
import { SalonSchema } from 'src/schemas/salon.schema';
import { ServiceSchema } from 'src/schemas/salonService.schema';
import { UserSchema } from '../schemas/user.schema';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { RedisCacheService } from '@/rediscloud.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Salon', schema: SalonSchema },
      { name: 'Coupon', schema: CouponSchema },
    ]),
  ],
  controllers: [CouponController],
  providers: [CouponService, CloudinaryService, RedisCacheService],
  exports: [CouponService],
})
export class CouponModule { }
