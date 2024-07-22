/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { RedisCacheService } from 'src/rediscloud.service';
import { SalonSchema } from 'src/schemas/salon.schema';
import { ReviewSchema } from 'src/schemas/salonReview.schema';
import { ServiceSchema } from 'src/schemas/salonService.schema';
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
