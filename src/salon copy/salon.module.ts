/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { SalonSchema } from 'src/schemas/salon.schema';
import { UserSchema } from '../schemas/user.schema';
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Salon', schema: SalonSchema },
    ]),
  ],
  controllers: [SalonController],
  providers: [SalonService, CloudinaryService, RedisCacheService],
  exports: [SalonService],
})
export class SalonModule { }
