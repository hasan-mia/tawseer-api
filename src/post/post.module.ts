/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { RedisCacheService } from '@/rediscloud.service';
import { FriendSchema } from '@/schemas/friend.schema';
import { PhotoSchema } from '@/schemas/photo.schema';
import { PostSchema } from '@/schemas/post.schema';
import { VideoSchema } from '@/schemas/video.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../schemas/user.schema';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Post', schema: PostSchema },
      { name: 'Photo', schema: PhotoSchema },
      { name: 'Video', schema: VideoSchema },
      { name: 'Friend', schema: FriendSchema },
    ]),
  ],
  controllers: [PostController],
  providers: [PostService, CloudinaryService, RedisCacheService],
  exports: [PostService],
})
export class PostModule { }
