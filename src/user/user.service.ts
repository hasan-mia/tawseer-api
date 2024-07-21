/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiFeatures } from 'src/helpers/apiFeatures.helper';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';
import { UserProfileDto } from './dto/userprofile.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Update User Profile ========
  async updateProfile(id: string, data: UserProfileDto) {

    try {

      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updatedUserData = { ...user.toObject(), ...data };

      const updatedUser = await this.userModel.findByIdAndUpdate(id, updatedUserData);

      // remove caching
      await this.redisCacheService.del('getAllUserByAdmin');
      await this.redisCacheService.del(`myInfo${id}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedUser,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get All User by admin ========
  async allUser(req: any) {
    try {
      const cacheKey = 'getAllUserByAdmin';
      const cacheData = await this.redisCacheService.get(cacheKey);
      if (cacheData) {
        return cacheData;
      }

      const { keyword } = req.query;

      let perPage: number | undefined;

      if (req.query && typeof req.query.limit === 'string') {
        perPage = parseInt(req.query.limit, 10)
      }

      // Construct the search criteria
      const searchCriteria = { name: String || null };
      if (keyword) {
        searchCriteria.name = keyword;
      }

      const count = await this.userModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.userModel.find(searchCriteria).select('-__v -password').sort({ createdAt: -1 }),
        req.query,
      )
        .search()
        .filter();

      if (perPage !== undefined) {
        apiFeature.pagination(perPage)
      }

      const result = await apiFeature.query
      const limit = result.length

      const currentPage = req.query.page
        ? parseInt(req.query.page as string, 10)
        : 1

      let totalPages: number | undefined;

      if (perPage !== undefined) {
        totalPages = Math.ceil(count / perPage)
      }

      let nextPage: number | null = null
      let nextUrl: string | null = null

      if (perPage !== undefined && currentPage < totalPages!) {
        nextPage = currentPage + 1
        nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`
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
      }

      await this.redisCacheService.set(cacheKey, data, 1800);

      return data;

    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ========= Change user role ======
  async updateUserRole(id: string, data: UserProfileDto) {
    try {
      const exists = await this.userModel.findByIdAndUpdate(id).exec();

      if (!exists) {
        throw new NotFoundException('Use not found');
      }
      const updatedData = await this.userModel
        .updateOne({ _id: id }, { role: data.role })
        .exec();

      // remove caching
      await this.redisCacheService.del('getAllUserByAdmin');
      await this.redisCacheService.del(`myInfo${id}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedData
      }

      return result;

    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }


  // ========= Change user Verification status ======
  async changeVerifyStatus(id: string, data: UserProfileDto) {
    try {
      const exists = await this.userModel.findByIdAndUpdate(id).exec();

      if (!exists) {
        throw new NotFoundException('Use not found');
      }
      const updatedData = await this.userModel
        .updateOne({ _id: id }, { is_verified: data.is_verified })
        .exec();

      // remove caching
      await this.redisCacheService.del('getAllUserByAdmin');
      await this.redisCacheService.del(`myInfo${id}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedData
      }

      return result;

    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
