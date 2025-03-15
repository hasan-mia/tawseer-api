/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ReviewSchema } from 'src/schemas/review.schema';
import { SalonSchema } from 'src/schemas/salon.schema';
import { ServiceSchema } from 'src/schemas/service.schema';
import { UserSchema } from '../schemas/user.schema';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Salon', schema: SalonSchema },
      { name: 'Review', schema: ReviewSchema },
    ]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService, CloudinaryService, RedisCacheService],
  exports: [ReviewService],
})
export class ReviewModule { }
