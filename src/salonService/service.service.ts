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
import { Service } from 'src/schemas/salonService.schema';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';
import { ServiceDto } from './dto/service.dto';

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Service.name)
    private serviceModel: Model<Service>,
    @InjectModel(Salon.name)
    private salonModel: Model<Salon>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new service ========
  async createService(id: string, data: ServiceDto) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const salon = await this.salonModel.findOne({ vendor: id }).exec();

      if (!salon) {
        throw new NotFoundException('Salon not found');
      }

      const finalData = {
        user: id,
        salon: salon._id,
        ...data,
      };

      const saveData = await this.serviceModel.create(finalData);

      // remove caching
      await this.redisCacheService.del('getAllService');

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

  // ======== Update service ========
  async updateService(id: string, postId: string, data: ServiceDto) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.serviceModel
        .findOne({ _id: postId, user: id })
        .exec();

      if (!exist) {
        throw new NotFoundException('Post not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.serviceModel.findByIdAndUpdate(
        exist._id,
        updatedData
      );

      // remove caching
      await this.redisCacheService.del('getAllService');
      await this.redisCacheService.del(`serviceDetails${exist._id}`);

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

  // ======== Get all service ========
  async getAllService(req: any) {
    try {
      const cacheKey = 'getAllService';
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
      const searchCriteria = { name: String || null };
      if (keyword) {
        searchCriteria.name = keyword;
      }

      const count = await this.serviceModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.serviceModel
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

  // ======== Get service details by ID ========
  async getServiceDetails(id: string) {
    try {
      const cacheKey = `serviceDetails${id}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      if (cacheData) {
        return cacheData;
      }

      const data = await this.serviceModel.findById(id).exec();

      if (!data) {
        throw new NotFoundException('Post not found');
      }

      // remove caching
      await this.redisCacheService.set(cacheKey, data, 1800);

      const result = {
        success: true,
        message: 'Post found successfully',
        data: data,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get all service by salon ID ========
  async getAllServiceBySalonId(req: any) {
    const salonId = req.params.id;
    try {
      const cacheKey = `getAllSalonService${salonId}`;
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

      const count = await this.serviceModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.serviceModel
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
