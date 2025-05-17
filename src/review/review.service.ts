/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisCacheService } from '../rediscloud.service';
import { Product } from '../schemas/product.schema';
import { Review } from '../schemas/review.schema';
import { Service } from '../schemas/service.schema';
import { User } from '../schemas/user.schema';
import { Vendor } from '../schemas/vendor.schema';
import { ReviewDto, ReviewUpdateDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Review.name) private reviewModel: Model<Review>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new review ========
  async createReview(userId: string, data: ReviewDto) {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) throw new NotFoundException('User not found');

      const finalData = { user: userId, ...data };
      const saveData = await this.reviewModel.create(finalData);

      // Remove caching based on type
      if (data.type === 'service') {
        await this.redisCacheService.del(`getAllServiceReview${data.service}`);
      } else if (data.type === 'vendor') {
        await this.redisCacheService.del(`getAllVendorReview${data.vendor}`);
      } else if (data.type === 'product') {
        await this.redisCacheService.del(`getAllProductReview${data.product}`);
      }

      return { success: true, message: 'Review created successfully', data: saveData };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Update review ========
  async updateReview(userId: string, reviewId: string, data: ReviewUpdateDto) {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) throw new NotFoundException('User not found');

      const review = await this.reviewModel.findOne({ _id: reviewId, user: userId }).exec();
      if (!review) throw new NotFoundException('Review not found');

      Object.assign(review, data);
      await review.save();

      // Remove caching based on type
      if (review.type === 'service') {
        await this.redisCacheService.del(`getAllServiceReview${review.service}`);
      } else if (review.type === 'vendor') {
        await this.redisCacheService.del(`getAllVendorReview${review.vendor}`);
      } else if (review.type === 'product') {
        await this.redisCacheService.del(`getAllProductReview${review.product}`);
      }

      return { success: true, message: 'Review updated successfully', data: review };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get reviews by entity ID ========
  async getReviewsByType(type: 'service' | 'vendor' | 'product', id: string, req: any) {
    try {
      const cacheKey = `getAll${type.charAt(0).toUpperCase() + type.slice(1)}Review${id}`;
      const cacheData = await this.redisCacheService.get(cacheKey);
      if (cacheData) return cacheData;

      const { keyword, limit, page } = req.query;
      const perPage = limit ? parseInt(limit, 10) : undefined;
      const currentPage = page ? parseInt(page, 10) : 1;

      const searchCriteria: any = { [type]: id };
      if (keyword) searchCriteria.message = { $regex: keyword, $options: 'i' };

      const count = await this.reviewModel.countDocuments(searchCriteria);

      const query = this.reviewModel
        .find(searchCriteria)
        .select('-__v')
        .sort({ createdAt: -1 })
        .limit(perPage)
        .skip(perPage ? (currentPage - 1) * perPage : 0);

      const result = await query.exec();

      const totalPages = perPage ? Math.ceil(count / perPage) : undefined;
      const nextPage = totalPages && currentPage < totalPages ? currentPage + 1 : null;
      const nextUrl = nextPage ? `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}` : null;

      const response = { success: true, data: result, total: count, perPage, nextPage, nextUrl };
      await this.redisCacheService.set(cacheKey, response, 60);
      return response;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  // ======== Get reviews by ID based on type ========
  async getReviewsByTypeId(type: string, id: string) {
    try {
      const cacheKey = `getAll${type}Review${id}`;
      const cachedData = await this.redisCacheService.get(cacheKey);

      if (cachedData) return cachedData;

      const searchCriteria = { [type]: id };
      const reviews = await this.reviewModel.find(searchCriteria).sort({ createdAt: -1 });

      const response = {
        success: true,
        total: reviews.length,
        data: reviews,
      };

      await this.redisCacheService.set(cacheKey, response, 60);
      return response;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

}
