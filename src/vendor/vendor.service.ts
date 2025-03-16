import { RedisCacheService } from '@/rediscloud.service';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import slugify from 'slugify';
import { Vendor } from 'src/schemas/vendor.schema';
import { User } from '../schemas/user.schema';
import { updateVendor } from './dto/updateVendor.dto';
import { VendorDto } from './dto/vendor.dto';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Vendor.name)
    private vendorModel: Model<Vendor>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new Vendor ========
  async createVendor(id: string, data: VendorDto) {
    try {
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.role !== 'vendor') {
        throw new BadRequestException('Only vendors can create a Vendor profile');
      }
      const exist = await this.vendorModel.findOne({ vendor: id }).exec();
      if (exist) {
        throw new BadRequestException('Vendor profile already exists');
      }

      const slug = slugify(data.name, { lower: true, strict: true });

      const finalData = {
        vendor: id,
        ...data,
        slug,
      };

      const saveData = await this.vendorModel.create(finalData);

      await this.redisCacheService.del('getAllVendor');

      return {
        success: true,
        message: 'Vendor created successfully',
        data: saveData,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }


  // ======== Update Vendor Profile ========
  async updateVendor(id: string, vendorId: string, data: updateVendor) {

    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const existVendor = await this.vendorModel.findOne({ _id: vendorId, vendor: id }).exec();

      if (!existVendor) {
        throw new NotFoundException('Vendor not found');
      }

      const updatedVendorData = { ...existVendor.toObject(), ...data };

      const updatedVendor = await this.vendorModel.findByIdAndUpdate(existVendor._id, updatedVendorData, { new: true, upsert: true });

      // remove caching
      await this.redisCacheService.del('getAllVendor');
      await this.redisCacheService.del(`VendorInfo${existVendor._id}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedVendor,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get All Vendor ========
  async getAllVendor(req: any) {
    try {
      const cacheKey = 'getAllVendor';
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

      const count = await this.vendorModel.countDocuments(searchCriteria);

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? perPage * (currentPage - 1) : 0;

      const result = await this.vendorModel
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

  // ======== Get single Vendor info by ID ========
  async getVendorInfo(slug: string) {
    try {
      const cacheKey = `VendorInfo${slug}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      // if (cacheData) {
      //   return cacheData;
      // }

      const data = await this.vendorModel.findOne({ slug }).populate("vendor", "first_name last_name email mobile").exec();

      if (!data) {
        throw new NotFoundException('Vendor not found');
      }

      // remove caching
      await this.redisCacheService.set(cacheKey, data, 1800);

      const result = {
        success: true,
        message: 'Vendor found successfully',
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

  // ======== Delete Vendor by ID ========
  async deleteVendor(id: string) {
    try {
      const data = await this.vendorModel.findByIdAndDelete(id);

      if (!data) {
        throw new NotFoundException('Vendor not found');
      }

      // remove caching
      await this.redisCacheService.del('getAllVendor');
      await this.redisCacheService.del(`VendorInfo${data._id}`);

      const result = {
        success: true,
        message: 'Vendor found successfully',
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
