/* eslint-disable prettier/prettier */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiFeatures } from 'src/helpers/apiFeatures.helper';
import { Coupon } from 'src/schemas/coupon.schema';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';
import { CouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Coupon.name)
    private couponModel: Model<Coupon>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new coupon ========
  async createCoupon(id: string, data: CouponDto) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const finalData = {
        user: id,
        ...data,
      };

      const saveData = await this.couponModel.create(finalData);

      // remove caching
      await this.redisCacheService.del(`getAllSalonCoupon${data.salon}`);

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

  // ======== Update coupon ========
  async updateCoupon(id: string, couponId: string, data: CouponDto) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.couponModel
        .findOne({ _id: couponId, user: id })
        .exec();

      if (!exist) {
        throw new NotFoundException('Coupon not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.couponModel.findByIdAndUpdate(
        exist._id,
        updatedData
      );

      // remove caching
      await this.redisCacheService.del(`getAllSalonCoupon${exist.salon}`);

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

  // ======== Get all coupon by salon ID ========
  async getCouponBySalonId(req: any) {
    const salonId = req.params.id;
    try {
      const cacheKey = `getAllSalonCoupon${salonId}`;
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

      const count = await this.couponModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.couponModel
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
