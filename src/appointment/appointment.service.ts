/* eslint-disable prettier/prettier */
import { Appointment } from '@/schemas/appointment.schema';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiFeatures } from 'src/helpers/apiFeatures.helper';
import { Service } from 'src/schemas/service.schema';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';
import { AppointmentDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Service.name)
    private serviceModel: Model<Service>,
    @InjectModel(Appointment.name)
    private appointmentModel: Model<Appointment>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new appointment / order ========
  async createAppointment(userId: string, serviceId: string, data: AppointmentDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const service = await this.serviceModel.findOne({ _id: serviceId }).exec();

      if (!service) {
        throw new NotFoundException('service not found');
      }

      const finalData = {
        user: userId,
        service: service._id,
        vendor: service.vendor,
        ...data,
      };

      const saveData = await this.appointmentModel.create(finalData);

      // remove caching
      await this.redisCacheService.del('getAllAppointment');
      await this.redisCacheService.del(`getAllSalonAppointment${service.vendor}`);
      await this.redisCacheService.del(`getConfirmSalonAppointment${service.vendor}`);
      await this.redisCacheService.del(`getAllUserAppointment${userId}`);

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

  // ======== Update appointment / order ========
  async updateAppointment(userId: string, appointmentId: string, data: AppointmentDto) {
    try {
      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const exist = await this.appointmentModel
        .findOne({ _id: appointmentId, user: userId })
        .exec();

      if (!exist) {
        throw new NotFoundException('Post not found');
      }

      const updatedData = { ...exist.toObject(), ...data };

      const updatedSaveData = await this.appointmentModel.findByIdAndUpdate(
        exist._id,
        updatedData
      );

      // remove caching
      await this.redisCacheService.del('getAllAppointment');
      await this.redisCacheService.del(`getAllSalonAppointment${exist.salon}`);
      await this.redisCacheService.del(`getConfirmSalonAppointment${exist.salon}`);
      await this.redisCacheService.del(`getAllUserAppointment${userId}`);

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

  // ======== Get all appointment / order ========
  async getAllAppointment(req: any) {
    try {
      const cacheKey = 'getAllAppointment';
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

      const count = await this.appointmentModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.appointmentModel
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

  // ======== Get appointment / order by user ID ========
  async getAllAppointmentByUser(req: any) {
    const userId = req.user.id;
    try {
      const cacheKey = `getAllUserAppointment${userId}`;
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
      const searchCriteria = { user: userId, name: String || null };
      if (keyword) {
        searchCriteria.name = keyword;
      }

      const count = await this.appointmentModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.appointmentModel
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

  // ======== Get all appointment / order by salon ID ========
  async getAllAppointmentBySalon(req: any) {
    const salonId = req.params.id;
    try {
      const cacheKey = `getAllSalonAppointment${salonId}`;
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

      const count = await this.appointmentModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.appointmentModel
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

  // ======== Get confirm appointment / order by salon ID ========
  async getConfirmAppointmentBySalon(req: any) {
    const salonId = req.params.id;
    try {
      const cacheKey = `getConfirmSalonAppointment${salonId}`;
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
      const searchCriteria = { salon: salonId, status: 'confirm', name: String || null };
      if (keyword) {
        searchCriteria.name = keyword;
      }

      const count = await this.appointmentModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.appointmentModel
          .find(searchCriteria)
          .select('-__v')
          .sort({ createdAt: 1 }),
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
