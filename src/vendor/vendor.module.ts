/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { VendorFollowSchema } from '@/schemas/vendorFollow.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { VendorSchema } from 'src/schemas/vendor.schema';
import { UserSchema } from '../schemas/user.schema';
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
