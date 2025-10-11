/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { RedisCacheService } from '@/rediscloud.service';
import { ServiceSchema } from '@/schemas/service.schema';
import { UserSchema } from '@/schemas/user.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Vendor', schema: VendorSchema },
    ]),
  ],
  controllers: [ServiceController],
  providers: [ServiceService, CloudinaryService, RedisCacheService],
  exports: [ServiceService],
})
export class ServiceModule { }
