/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment } from 'src/schemas/comment.schema';
import { Post } from 'src/schemas/post.schema';
import { Reply } from 'src/schemas/reply.schema';
import { User } from '../schemas/user.schema';
import { ReplyDto } from './dto/reply.dto';

@Injectable()
export class ReplyService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Post.name)
    private postModel: Model<Post>,
    @InjectModel(Comment.name)
    private commentModel: Model<Comment>,
    @InjectModel(Reply.name)
    private replyModel: Model<Reply>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new reply ========
  async createReply(userId: string, commentId: string, data: ReplyDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const comment = await this.commentModel.findById(commentId).exec();

      if (!comment) {
        throw new NotFoundException("Comment not found")
      }

      const finalData = {
        user: userId,
        post: comment.post,
        comment: commentId,
        ...data,
      };

      const saveData = await this.replyModel.create(finalData);

      // remove caching
      await this.redisCacheService.del(`getAllComment${comment.post}`);
      await this.redisCacheService.del(`getAllReply${comment.post}`);

      const result = {
        success: true,
        message: 'Create successfully',
        data: saveData,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Update reply ========
  async updateReply(userId: string, replyId: string, data: ReplyDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.replyModel
        .findOne({ _id: replyId, user: userId, is_deleted: false })
        .exec();

      if (!exist) {
        throw new NotFoundException('Reply not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.replyModel.findByIdAndUpdate(
        exist._id,
        updatedData,
        { new: true }
      );

      // remove caching
      await this.redisCacheService.del(`getAllComment${exist.post}`);
      await this.redisCacheService.del(`getAllReply${exist.post}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedSaveData,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Delete reply ========
  async deleteReply(userId: string, replyId: string) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.replyModel
        .findOne({ _id: replyId, user: userId, is_deleted: false })
        .exec();

      if (!exist) {
        throw new NotFoundException('Reply not found');
      }

      const updatedData = { is_deleted: true, };

      const updatedSaveData = await this.replyModel.findByIdAndUpdate(
        exist._id,
        updatedData,
        { new: true }
      );

      // remove caching
      await this.redisCacheService.del(`getAllComment${exist.post}`);
      await this.redisCacheService.del(`getAllReply${exist.post}`);

      const result = {
        success: true,
        message: 'Delete successfully',
        data: updatedSaveData,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get all reply by comment ID ========
  async getReplyByCommentId(req: any) {
    const commentId = req.params.id;
    try {
      const cacheKey = `getAllReply${commentId}`;
      const cacheData = await this.redisCacheService.get(cacheKey);
      // if (cacheData) {
      //   return cacheData;
      // }

      const { keyword, limit, page } = req.query;

      let perPage: number | undefined;
      if (typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const searchCriteria: any = { comment: commentId, is_deleted: false };
      if (keyword) {
        searchCriteria.text = { $regex: keyword, $options: 'i' };
      }

      const count = await this.replyModel.countDocuments(searchCriteria);

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? (currentPage - 1) * perPage : 0;

      const query = this.replyModel
        .find(searchCriteria)
        .select('text image')
        .sort({ createdAt: -1 })
        .skip(skip);

      if (perPage) {
        query.limit(perPage);
      }

      const result = await query.exec();
      const totalPages = perPage ? Math.ceil(count / perPage) : 1;

      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (perPage && currentPage < totalPages) {
        nextPage = currentPage + 1;
        nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
        if (keyword) {
          nextUrl += `&keyword=${keyword}`;
        }
      }

      const data = {
        success: true,
        data: result || [],
        total: count,
        perPage,
        limit,
        currentPage,
        totalPages,
        nextPage,
        nextUrl,
      };

      await this.redisCacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

}
