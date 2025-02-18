/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiFeatures } from 'src/helpers/apiFeatures.helper';
import { Salon } from 'src/schemas/salon.schema';
import { User } from '../schemas/user.schema';
import { SalonDto } from './dto/salon.dto';

@Injectable()
export class SalonService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Salon.name)
    private salonModel: Model<Salon>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new Salon ========
  async createSalon(id: string, data: SalonDto) {

    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== 'vendor') {
        throw new NotFoundException('Only vendor can create salon');
      }

      const exist = await this.salonModel.findOne({ vendor: id }).exec();

      if (exist) {
        throw new NotFoundException('Already have a salon');
      }

      const finalData = {
        vendor: id,
        ...data,
      }

      const saveData = await this.salonModel.create(finalData);

      // remove caching
      await this.redisCacheService.del('getAllSalon');

      const result = {
        success: true,
        message: 'Crate successfully',
        data: saveData,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Update salon Profile ========
  async updateSalon(id: string, salonId: string, data: SalonDto) {

    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const salon = await this.salonModel.findOne({ _id: salonId, vendor: id }).exec();

      if (!salon) {
        throw new NotFoundException('Salon not found');
      }

      const updatedSalonData = { ...salon.toObject(), ...data };

      const updatedSalon = await this.salonModel.findByIdAndUpdate(salon._id, updatedSalonData);

      // remove caching
      await this.redisCacheService.del('getAllSalon');
      await this.redisCacheService.del(`salonInfo${salon._id}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedSalon,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get All Salon ========
  async getAllSalon(req: any) {
    try {
      const cacheKey = 'getAllSalon';
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

      const count = await this.salonModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.salonModel.find(searchCriteria).select('-__v').sort({ createdAt: -1 }),
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

  // ======== Get single salon info by ID ========
  async getSalonInfo(id: string) {

    try {
      const cacheKey = `salonInfo${id}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      if (cacheData) {
        return cacheData;
      }

      const data = await this.salonModel.findById(id).exec();

      if (!data) {
        throw new NotFoundException('Salon not found');
      }

      // remove caching
      await this.redisCacheService.set(cacheKey, data, 1800);

      const result = {
        success: true,
        message: 'Salon found successfully',
        data: data,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

}
