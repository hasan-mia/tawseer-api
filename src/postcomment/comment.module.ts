import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { CommentSchema } from '@/schemas/comment.schema';
import { PostSchema } from '@/schemas/post.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
  providers: [CommentService, CloudinaryService],
  exports: [CommentService],
})
export class CommentModule { }
