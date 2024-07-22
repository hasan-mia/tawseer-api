/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { RedisCacheService } from 'src/rediscloud.service';
import { SalonSchema } from 'src/schemas/salon.schema';
import { ServiceSchema } from 'src/schemas/salonService.schema';
import { UserSchema } from '../schemas/user.schema';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Salon', schema: SalonSchema },
    ]),
  ],
  controllers: [ServiceController],
  providers: [ServiceService, CloudinaryService, RedisCacheService],
  exports: [ServiceService],
})
export class ServiceModule { }
