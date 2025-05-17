/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { getPublicIdFromUrl } from '@/helpers/myHelper.helper';
import { Friend } from '@/schemas/friend.schema';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post } from 'src/schemas/post.schema';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';
import { PostDto } from './dto/post.dto';

export interface Photo {
  _id: string;
  urls: string[];
}

export interface Video {
  _id: string;
  urls: string[];
}

export interface PopulatedPost {
  _id: string;
  photos: Photo[];
  videos: Video[];
}

@Injectable()
export class PostService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Post.name)
    private postModel: Model<Post>,
    @InjectModel(Friend.name)
    private friendModel: Model<Friend>,
    private readonly redisCacheService: RedisCacheService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // ======== Create new post ========
  async createPost(id: string, data: PostDto) {

    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const finalData = {
        user: id,
        ...data,
      }

      const saveData = await this.postModel.create(finalData);

      // remove caching
      await this.redisCacheService.del('getAllPost');

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

  // ======== Update post ========
  async updatePost(id: string, postId: string, data: PostDto) {

    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.postModel.findOne({ _id: postId, user: id }).exec();

      if (!exist) {
        throw new NotFoundException('Post not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.postModel.findByIdAndUpdate(exist._id, updatedData);

      // remove caching
      await this.redisCacheService.del('getAllPost');
      await this.redisCacheService.del(`postDetails${exist._id}`);

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

  // ======== Get all post ========
  async getAllPost(req: any) {
    try {
      const cacheKey = `getAllPost`;
      const cacheData = await this.redisCacheService.get(cacheKey);
      // if (cacheData) {
      //   return cacheData;
      // }

      const { keyword, limit, page } = req.query;

      let perPage: number | undefined;
      if (typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const searchCriteria: any = {};

      if (keyword) {
        searchCriteria.text = { $regex: keyword, $options: 'i' };
      }

      const count = await this.postModel.countDocuments(searchCriteria);

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? (currentPage - 1) * perPage : 0;

      const query = this.postModel
        .find(searchCriteria)
        .populate('user', 'name email mobile avatar cover')
        .populate('photos', 'urls')
        .populate('videos', 'urls')
        .select('-__v')
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

  // ======== Get post details by ID ========
  async getPostDetails(id: string) {

    try {
      const cacheKey = `postDetails${id}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      // if (cacheData) {
      //   return cacheData;
      // }

      const data = await this.postModel.findById(id)
        .populate('user', 'name email mobile avatar cover')
        .populate('photos', 'urls')
        .populate('videos', 'urls')
        .select('-__v')
        .exec();

      if (!data) {
        throw new NotFoundException('Post not found');
      }

      // remove caching
      await this.redisCacheService.set(cacheKey, data, 60);

      const result = {
        success: true,
        message: 'Post found successfully',
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get post by user ID ========
  async getAllPostByUserID(req: any) {
    const userId = req.params.id;

    try {
      const cacheKey = `getAllUserPost${userId}`;
      const cacheData = await this.redisCacheService.get(cacheKey);
      // if (cacheData) {
      //   return cacheData;
      // }

      const { keyword, limit, page } = req.query;

      let perPage: number | undefined;
      let currentPage: number | undefined = 1;

      if (typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }
      if (typeof page === 'string') {
        currentPage = parseInt(page, 10);
      }

      const searchCriteria: any = { user: userId };
      if (keyword) {
        searchCriteria.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
        ];
      }

      // Count total posts
      const count = await this.postModel.countDocuments(searchCriteria);

      // Build the query for retrieving posts
      let query = this.postModel
        .find(searchCriteria)
        .populate('user', 'name email mobile avatar cover')
        .populate('photos', 'urls')
        .populate('videos', 'urls')
        .select('-__v')
        .sort({ createdAt: -1 });

      if (perPage) {
        const skip = (currentPage - 1) * perPage;
        query = query.skip(skip).limit(perPage);
      }

      const result = await query.exec();
      const limitResult = result.length;

      // Calculate totalPages if perPage is specified
      let totalPages: number | undefined;
      if (perPage) {
        totalPages = Math.ceil(count / perPage);
      }

      // Prepare pagination details
      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (perPage && currentPage < totalPages!) {
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
        limit: limitResult,
        currentPage,
        totalPages,
        nextPage,
        nextUrl,
      };

      // Cache the result for 30 minutes
      await this.redisCacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ============Delete post by id============
  async deletePost(id: string): Promise<{ success: boolean; message: string; }> {
    try {
      const post = await this.postModel
        .findById(id)
        .populate({
          path: 'photos',
          select: 'urls'
        })
        .populate({
          path: 'videos',
          select: 'urls'
        })
        .exec() as unknown as PopulatedPost;

      if (!post) {
        throw new NotFoundException('Post not found');
      }

      console.log(post.photos && post.photos.length > 0)
      // Delete associated photos from Cloudinary
      if (post.photos && post.photos.length > 0) {
        for (const photo of post.photos) {
          if (photo.urls && photo.urls.length > 0) {
            for (const url of photo.urls) {
              const publicId = getPublicIdFromUrl(url);
              if (publicId) {
                await this.cloudinaryService.deleteFile(publicId);
              }
            }
          }
        }
      }

      // Delete associated videos from Cloudinary
      console.log(post.videos && post.videos.length > 0)
      if (post.videos && post.videos.length > 0) {
        for (const video of post.videos) {
          if (video.urls && video.urls.length > 0) {
            for (const url of video.urls) {
              const publicId = getPublicIdFromUrl(url);
              if (publicId) {
                await this.cloudinaryService.deleteFile(publicId);
              }
            }
          }
        }
      }

      // Now delete the post from the database
      await this.postModel.findByIdAndDelete(id);

      return {
        success: true,
        message: 'Post deleted successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get post of user firend and following user ========
  async getFriendsAndFollowingPosts(req: any) {
    const userId = req.user.id

    let targetUserId = userId

    if (userId === "friends-following" && req.user) {
      targetUserId = req.user._id
    } else if (userId === "friends-following") {
      throw new BadRequestException("User authentication required to view friends and following posts")
    }

    try {
      const cacheKey = `getFriendsAndFollowingPosts${targetUserId}`
      const cacheData = await this.redisCacheService.get(cacheKey)
      // Uncomment if you want to use caching
      // if (cacheData) {
      //   return cacheData;
      // }

      const { keyword, limit, page } = req.query

      let perPage: number | undefined
      let currentPage: number | undefined = 1

      if (typeof limit === "string") {
        perPage = Number.parseInt(limit, 10)
      }
      if (typeof page === "string") {
        currentPage = Number.parseInt(page, 10)
      }

      // Get the user's accepted friends
      const friendships = await this.friendModel
        .find({
          user: targetUserId,
          status: "accepted",
        })
        .select("friend")

      const friendIds = friendships.map((friendship) => friendship.friend)

      // Get the user's followings
      const user = await this.userModel.findById(targetUserId).select("followings")
      const followingIds = user?.followings || []

      // Combine friend and following IDs (removing duplicates)
      const combinedIds = [...new Set([...friendIds, ...followingIds])]

      // If user has no friends or followings, return empty result
      if (combinedIds.length === 0) {
        return {
          success: true,
          data: [],
          total: 0,
          perPage,
          limit: 0,
          currentPage,
          totalPages: 0,
          nextPage: null,
          nextUrl: null,
        }
      }

      // Build search criteria
      const searchCriteria: any = {
        user: { $in: combinedIds },
        is_deleted: false,
      }

      if (keyword) {
        searchCriteria.$or = [{ text: { $regex: keyword, $options: "i" } }]
      }

      // Count total posts
      const count = await this.postModel.countDocuments(searchCriteria)

      // Build the query for retrieving posts
      let query = this.postModel
        .find(searchCriteria)
        .populate("user", "first_name last_name email mobile avatar cover")
        .populate("photos", "urls")
        .populate("videos", "urls")
        .select("-__v")
        .sort({ createdAt: -1 })

      if (perPage) {
        const skip = (currentPage - 1) * perPage
        query = query.skip(skip).limit(perPage)
      }

      const result = await query.exec()

      // Calculate totalPages if perPage is specified
      let totalPages: number | undefined
      if (perPage) {
        totalPages = Math.ceil(count / perPage)
      }

      // Prepare pagination details
      let nextPage: number | null = null
      let nextUrl: string | null = null

      if (perPage && currentPage < totalPages!) {
        nextPage = currentPage + 1
        nextUrl = `${req.originalUrl.split("?")[0]}?limit=${perPage}&page=${nextPage}`
        if (keyword) {
          nextUrl += `&keyword=${keyword}`
        }
      }

      const data = {
        success: true,
        data: result || [],
        total: count,
        perPage,
        currentPage,
        totalPages,
        nextPage,
        nextUrl,
      }

      // Cache the result for 30 minutes
      await this.redisCacheService.set(cacheKey, data, 60)

      return data
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }
      throw new InternalServerErrorException(error.message)
    }
  }

}
