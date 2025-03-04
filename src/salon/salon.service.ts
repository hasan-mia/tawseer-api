/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
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

      const updatedSalon = await this.salonModel.findByIdAndUpdate(salon._id, updatedSalonData, { new: true, upsert: true });

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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
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

      const { keyword, limit, page, vendor } = req.query;

      let perPage: number | undefined;

      if (limit && typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const searchCriteria: any = {};

      if (keyword) {
        searchCriteria.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { mobile: { $regex: keyword, $options: 'i' } },
        ];
      }

      if (vendor) {
        searchCriteria.vendor = vendor;
      }

      const count = await this.salonModel.countDocuments(searchCriteria);

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? perPage * (currentPage - 1) : 0;

      const result = await this.salonModel
        .find(searchCriteria)
        .populate("vendor", "first_name last_name email mobile")
        .select('-__v')
        .skip(skip)
        .limit(perPage || 10)
        .sort({ createdAt: -1 })
        .exec();

      const totalPages = perPage ? Math.ceil(count / perPage) : 1;
      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (perPage && currentPage < totalPages) {
        nextPage = currentPage + 1;
        nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
        if (keyword) {
          nextUrl += `&keyword=${keyword}`;
        }
        if (vendor) {
          nextUrl += `&vendor=${vendor}`;
        }
      }

      const data = {
        success: true,
        data: result || [],
        total: count,
        perPage,
        limit: result.length,
        nextPage,
        nextUrl,
      };

      // Cache the result
      await this.redisCacheService.set(cacheKey, data, 1800);

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
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

      const data = await this.salonModel.findById(id).populate("vendor", "first_name last_name email mobile").exec();

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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

}
