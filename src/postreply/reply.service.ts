/* eslint-disable prettier/prettier */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiFeatures } from 'src/helpers/apiFeatures.helper';
import { Comment } from 'src/schemas/comment.schema';
import { Post } from 'src/schemas/post.schema';
import { Reply } from 'src/schemas/reply.schema';
import { RedisCacheService } from '../rediscloud.service';
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
  async createReply(userId: string, postId: string, data: ReplyDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const finalData = {
        user: userId,
        post: postId,
        ...data,
      };

      const saveData = await this.replyModel.create(finalData);

      // remove caching
      await this.redisCacheService.del(`getAllComment${postId}`);
      await this.redisCacheService.del(`getAllReply${postId}`);

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

  // ======== Update reply ========
  async updateReply(userId: string, commentId: string, data: ReplyDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.replyModel
        .findOne({ _id: commentId, user: userId })
        .exec();

      if (!exist) {
        throw new NotFoundException('Comment not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.replyModel.findByIdAndUpdate(
        exist._id,
        updatedData
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
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get all reply by comment ID ========
  async getReplyByCommentId(req: any) {
    const postId = req.params.id;
    try {
      const cacheKey = `getAllReply${postId}`;
      const cacheData = await this.redisCacheService.get(cacheKey);
      if (cacheData) {
        return cacheData;
      }

      const { keyword } = req.query;

      let perPage: number | undefined;

      if (req.query && typeof req.query.limit === 'string') {
        perPage = parseInt(req.query.limit, 10);
      }

      // Construct the search criteria
      const searchCriteria = { post: postId, name: String || null };
      if (keyword) {
        searchCriteria.name = keyword;
      }

      const count = await this.replyModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.replyModel
          .find(searchCriteria)
          .select('-__v')
          .sort({ createdAt: -1 }),
        req.query
      )
        .search()
        .filter();

      if (perPage !== undefined) {
        apiFeature.pagination(perPage);
      }

      const result = await apiFeature.query;
      const limit = result.length;

      const currentPage = req.query.page
        ? parseInt(req.query.page as string, 10)
        : 1;

      let totalPages: number | undefined;

      if (perPage !== undefined) {
        totalPages = Math.ceil(count / perPage);
      }

      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (perPage !== undefined && currentPage < totalPages!) {
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
