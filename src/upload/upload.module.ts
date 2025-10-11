/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { RedisCacheService } from '@/rediscloud.service';
import { PhotoSchema } from '@/schemas/photo.schema';
import { UserSchema } from '@/schemas/user.schema';
import { VideoSchema } from '@/schemas/video.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Photo', schema: PhotoSchema },
      { name: 'Video', schema: VideoSchema },
    ]),
  ],
  controllers: [UploadController],
  providers: [UploadService, CloudinaryService, RedisCacheService],
  exports: [UploadService]
})
export class UploadModule { }
