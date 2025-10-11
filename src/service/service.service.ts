
import { Service } from '@/schemas/service.schema';
import { User } from '@/schemas/user.schema';
import { Vendor } from '@/schemas/vendor.schema';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RedisCacheService } from '../rediscloud.service';
import { ServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Service.name)
    private serviceModel: Model<Service>,
    @InjectModel(Vendor.name)
    private vendorModel: Model<Vendor>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new service ========
  async createService(id: string, data: ServiceDto) {
    try {
      const user = await this.userModel.findById(id);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const existVendor = await this.vendorModel.findOne({ user: id });

      if (!existVendor) {
        throw new NotFoundException('Vendor not found');
      }

      const finalData = {
        user: id,
        vendor: existVendor._id,
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Update service ========
  async updateService(id: string, postId: string, data: UpdateServiceDto) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.serviceModel
        .findOne({ _id: postId, vendor: id })
        .exec();

      if (!exist) {
        throw new NotFoundException('Service not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.serviceModel.findByIdAndUpdate(
        exist._id,
        updatedData,
        { new: true, upsert: true },
      );

      // remove caching
      await this.redisCacheService.del('getAllService');
      await this.redisCacheService.del(`serviceDetails${exist._id}`);
      await this.redisCacheService.del(`getAllService-${id}`);

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

  // ======== Get all service ========
  async getAllService(req: any) {
    try {
      const cacheKey = `getAllService_${JSON.stringify(req.query)}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      if (cacheData) {
        return cacheData;
      }

      const { keyword, price, cat, limit, page } = req.query;

      let perPage: number | undefined;
      if (typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const searchCriteria: any = {};

      if (keyword) {
        searchCriteria.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
        ];
      }

      if (price) {
        const priceFilter: any = {};
        if (price.gte) priceFilter.$gte = price.gte;
        if (price.lte) priceFilter.$lte = price.lte;
        searchCriteria.price = priceFilter;
      }

      if (cat) {
        searchCriteria.category = cat;
      }

      const count = await this.serviceModel.countDocuments(searchCriteria);

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? (currentPage - 1) * perPage : 0;

      const query = this.serviceModel
        .find(searchCriteria)
        .populate('user', 'name mobile email')
        .populate('vendor', 'name email mobile')
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
        if (cat) {
          nextUrl += `&cat=${cat}`;
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

      // Cache the data
      await this.redisCacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
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

      const data = await this.serviceModel.findById(id)
        .populate('user', 'name mobile email')
        .populate('vendor', 'name email mobile')
        .exec();

      if (!data) {
        throw new NotFoundException('Service not found');
      }

      const result = {
        success: true,
        message: 'Service found successfully',
        data: data,
      };

      // save caching
      await this.redisCacheService.set(cacheKey, result, 60);

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get all service by vendor ID ========
  async getAllServiceByVendorId(id: string, req: any) {
    try {
      const cacheKey = `getAllService-${id}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      if (cacheData) {
        return cacheData;
      }

      const existVendor = await this.vendorModel.findById(id);
      if (!existVendor) {
        throw new NotFoundException('Vendor not found');
      }

      const { keyword, price, cat, limit, page } = req.query;

      let perPage: number | undefined;
      if (typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const searchCriteria: any = { vendor: new Types.ObjectId(id), is_deleted: false, };

      if (keyword) {
        searchCriteria.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
        ];
      }

      if (price) {
        const priceFilter: any = {};
        if (price.gte) priceFilter.$gte = price.gte;
        if (price.lte) priceFilter.$lte = price.lte;
        searchCriteria.price = priceFilter;
      }

      if (cat) {
        searchCriteria.category = cat;
      }

      const count = await this.serviceModel.countDocuments(searchCriteria);

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? (currentPage - 1) * perPage : 0;

      const query = this.serviceModel
        .find(searchCriteria)
        .populate('user', 'name mobile email')
        .populate('vendor', 'name email mobile')
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
        if (cat) {
          nextUrl += `&cat=${cat}`;
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

      // Cache the data
      await this.redisCacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  // ======== Delete service by ID ========
  async deleteService(id: string, userId: string) {
    try {
      const data = await this.serviceModel.findOneAndDelete({ _id: id, user: userId })

      if (!data) {
        throw new NotFoundException('Service not found');
      }

      const result = {
        success: true,
        message: 'Service delete successfully',
      };

      // remove caching
      await this.redisCacheService.del('getAllService');
      await this.redisCacheService.del(`serviceDetails${id}`);
      await this.redisCacheService.del(`getAllService-${id}`);

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


}
