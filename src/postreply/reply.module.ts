/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CommentSchema } from 'src/schemas/comment.schema';
import { PostSchema } from 'src/schemas/post.schema';
import { ReplySchema } from 'src/schemas/reply.schema';
import { UserSchema } from '../schemas/user.schema';
import { ReplyController } from './reply.controller';
import { ReplyService } from './reply.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Post', schema: PostSchema },
      { name: 'Comment', schema: CommentSchema },
      { name: 'Reply', schema: ReplySchema },
    ]),
  ],
  controllers: [ReplyController],
  providers: [ReplyService, CloudinaryService, RedisCacheService],
  exports: [ReplyService],
})
export class ReplyModule { }
