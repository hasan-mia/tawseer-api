/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PhotoSchema } from 'src/schemas/photo.schema';
import { UserSchema } from 'src/schemas/user.schema';
import { VideoSchema } from 'src/schemas/video.schema';
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
