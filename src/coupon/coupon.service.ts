import { Coupon } from '@/schemas/coupon.schema';
import { User } from '@/schemas/user.schema';
import { Vendor } from '@/schemas/vendor.schema';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiFeatures } from 'src/helpers/apiFeatures.helper';
import { RedisCacheService } from '../rediscloud.service';
import { CouponDto, CouponUpdateDto } from './dto/coupon.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Vendor.name)
    private vendorModel: Model<Vendor>,
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

      const existingCoupon = await this.couponModel.findOne({ code: data.code });
      if (existingCoupon) {
        throw new Error('Coupon code already exists');
      }

      if (data.expiredAt && new Date(data.expiredAt) < new Date()) {
        throw new Error('Expiration date must be in the future');
      }

      const finalData = { user: id, ...data };

      const saveData = await this.couponModel.create(finalData);

      // if (data.vendor) {
      //   await this.redisCacheService.del(`getAllVendorCoupon${data.vendor}`);
      // }

      return { success: true, message: 'Created successfully', data: saveData };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Update coupon ========
  async updateCoupon(id: string, couponId: string, data: CouponUpdateDto) {
    try {
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.couponModel.findOne({ _id: couponId, user: id }).exec();
      if (!exist) {
        throw new NotFoundException('Coupon not found');
      }

      // Ensure unique coupon code if updating
      if (data.code && data.code !== exist.code) {
        const duplicateCoupon = await this.couponModel.findOne({ code: data.code });
        if (duplicateCoupon) {
          throw new Error('Coupon code already exists');
        }
      }

      // Ensure expiration date is in the future
      if (data.expiredAt && new Date(data.expiredAt) < new Date()) {
        throw new Error('Expiration date must be in the future');
      }

      // Update coupon
      const updatedSaveData = await this.couponModel.findByIdAndUpdate(
        exist._id,
        { $set: data },
        { new: true }
      );

      // Remove cache
      if (exist.vendor) {
        await this.redisCacheService.del(`getAllVendorCoupon${exist.vendor}`);
      }

      return { success: true, message: 'Updated successfully', data: updatedSaveData };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  // ======== Get all coupon by Vendor ID ========
  async getCouponByVendorId(req: any) {
    const salonId = req.params.id;
    try {
      const cacheKey = `getAllVendorCoupon${salonId}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      if (cacheData) {
        return JSON.parse(cacheData); // Ensure JSON parsing
      }

      const { keyword } = req.query;

      let perPage: number | undefined;
      if (req.query && typeof req.query.limit === 'string') {
        perPage = parseInt(req.query.limit, 10);
      }

      // Correct search query: vendor instead of salon
      const searchCriteria: any = { vendor: salonId };
      if (keyword) {
        searchCriteria.code = { $regex: keyword, $options: 'i' };
      }

      const count = await this.couponModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.couponModel.find(searchCriteria).select('-__v').sort({ createdAt: -1 }),
        req.query
      ).search().filter();

      if (perPage !== undefined) {
        apiFeature.pagination(perPage);
      }

      const result = await apiFeature.query;
      const limit = result.length;

      const currentPage = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const totalPages = perPage !== undefined ? Math.ceil(count / perPage) : undefined;

      const nextPage = perPage !== undefined && currentPage < totalPages ? currentPage + 1 : null;
      let nextUrl = null;

      if (nextPage) {
        nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
        if (keyword) {
          nextUrl += `&keyword=${keyword}`;
        }
      }

      const data = { success: true, data: result, total: count, perPage, limit, nextPage, nextUrl };

      await this.redisCacheService.set(cacheKey, JSON.stringify(data), 120); // Store as JSON

      return data;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }



}
