/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { FriendSchema } from '@/schemas/friend.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PhotoSchema } from 'src/schemas/photo.schema';
import { PostSchema } from 'src/schemas/post.schema';
import { VideoSchema } from 'src/schemas/video.schema';
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
