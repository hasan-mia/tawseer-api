/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { RedisCacheService } from '@/rediscloud.service';
import { CommentSchema } from '@/schemas/comment.schema';
import { PostSchema } from '@/schemas/post.schema';
import { ReplySchema } from '@/schemas/reply.schema';
import { UserSchema } from '@/schemas/user.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
