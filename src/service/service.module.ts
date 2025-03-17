/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ServiceSchema } from 'src/schemas/service.schema';
import { UserSchema } from '../schemas/user.schema';
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
