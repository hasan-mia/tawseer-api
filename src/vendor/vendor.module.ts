/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { RedisCacheService } from '@/rediscloud.service';
import { UserSchema } from '@/schemas/user.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { VendorFollowSchema } from '@/schemas/vendorFollow.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'VendorFollow', schema: VendorFollowSchema },
    ]),
  ],
  controllers: [VendorController],
  providers: [VendorService, CloudinaryService, RedisCacheService],
  exports: [VendorService],
})
export class VendorModule { }
