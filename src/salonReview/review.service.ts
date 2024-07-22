/* eslint-disable prettier/prettier */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiFeatures } from 'src/helpers/apiFeatures.helper';
import { Salon } from 'src/schemas/salon.schema';
import { Review } from 'src/schemas/salonReview.schema';
import { Service } from 'src/schemas/salonService.schema';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';
import { ReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Service.name)
    private serviceModel: Model<Service>,
    @InjectModel(Salon.name)
    private salonModel: Model<Salon>,
    @InjectModel(Review.name)
    private reviewModel: Model<Review>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new review ========
  async createReview(id: string, data: ReviewDto) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const finalData = {
        user: id,
        ...data,
      };

      const saveData = await this.reviewModel.create(finalData);

      // remove caching
      await this.redisCacheService.del(`getAllServiceReview${data.service}`);
      await this.redisCacheService.del(`getAllSalonReview${data.salon}`);

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

  // ======== Update review ========
  async updateReview(id: string, reviewId: string, data: ReviewDto) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.reviewModel
        .findOne({ _id: reviewId, user: id })
        .exec();

      if (!exist) {
        throw new NotFoundException('Post not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.reviewModel.findByIdAndUpdate(
        exist._id,
        updatedData
      );

      // remove caching
      await this.redisCacheService.del(`getAllServiceReview${exist.service}`);
      await this.redisCacheService.del(`getAllSalonReview${exist.salon}`);


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

  // ======== Get all review by salon ID ========
  async getReviewBySalonId(req: any) {
    const salonId = req.params.id;
    try {
      const cacheKey = `getAllSalonReview${salonId}`;
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
      const searchCriteria = { salon: salonId, name: String || null };
      if (keyword) {
        searchCriteria.name = keyword;
      }

      const count = await this.reviewModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.reviewModel
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

  // ======== Get all review by service ID ========
  async getReviewByServiceId(req: any) {
    const serviceId = req.params.id;
    try {
      const cacheKey = `getAllServiceReview${serviceId}`;
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
      const searchCriteria = { service: serviceId, name: String || null };
      if (keyword) {
        searchCriteria.name = keyword;
      }

      const count = await this.reviewModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.reviewModel
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
