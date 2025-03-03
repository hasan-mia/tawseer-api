/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment } from 'src/schemas/comment.schema';
import { Post } from 'src/schemas/post.schema';
import { User } from '../schemas/user.schema';
import { CommentDto } from './dto/comment.dto';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Post.name)
    private postModel: Model<Post>,
    @InjectModel(Comment.name)
    private commentModel: Model<Comment>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new comment ========
  async createComment(userId: string, postId: string, data: CommentDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const post = await this.postModel.findById(postId).exec();

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const finalData = {
        user: userId,
        post: postId,
        ...data,
      };

      const saveData = await this.commentModel.create(finalData);

      // remove caching
      await this.redisCacheService.del(`getAllComment${postId}`);

      const result = {
        success: true,
        message: 'Create successfully',
        data: saveData,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Update comment ========
  async updateComment(userId: string, commentId: string, data: CommentDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.commentModel
        .findOne({ _id: commentId, user: userId })
        .exec();

      if (!exist) {
        throw new NotFoundException('Comment not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.commentModel.findByIdAndUpdate(
        exist._id,
        updatedData,
        { new: true }
      );

      // remove caching
      await this.redisCacheService.del(`getAllComment${exist.post}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedSaveData,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Delete comment ========
  async deleteComment(userId: string, commentId: string) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.commentModel
        .findOne({ _id: commentId, user: userId, is_deleted: false })
        .exec();

      if (!exist) {
        throw new NotFoundException('Comment not found');
      }

      const updatedData = { is_deleted: true };

      const updatedSaveData = await this.commentModel.findByIdAndUpdate(
        exist._id,
        updatedData,
        { new: true }
      );

      // remove caching
      await this.redisCacheService.del(`getAllComment${exist.post}`);

      const result = {
        success: true,
        message: 'Delete successfully',
        data: updatedSaveData,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get all comment by post ID ========
  async getCommentByPostId(req: any) {
    const postId = req.params.id;
    try {
      const cacheKey = `getAllComment${postId}`;
      const cacheData = await this.redisCacheService.get(cacheKey);
      // if (cacheData) {
      //   return cacheData;
      // }

      const { keyword, limit, page } = req.query;

      let perPage: number | undefined;
      if (typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const searchCriteria: any = { post: postId, is_deleted: false };
      if (keyword) {
        searchCriteria.text = { $regex: keyword, $options: 'i' };
      }

      const count = await this.commentModel.countDocuments(searchCriteria);

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? (currentPage - 1) * perPage : 0;

      const query = this.commentModel
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

      await this.redisCacheService.set(cacheKey, data, 1800);

      return data;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

}
