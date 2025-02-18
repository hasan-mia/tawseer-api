/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CommentSchema } from 'src/schemas/comment.schema';
import { PostSchema } from 'src/schemas/post.schema';
import { UserSchema } from '../schemas/user.schema';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Post', schema: PostSchema },
      { name: 'Comment', schema: CommentSchema },
    ]),
  ],
  controllers: [CommentController],
  providers: [CommentService, CloudinaryService, RedisCacheService],
  exports: [CommentService],
})
export class CommentModule { }
