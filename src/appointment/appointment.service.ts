/* eslint-disable prettier/prettier */
import { StripeService } from '@/payment/stripe.service';
import { TransactionService } from '@/payment/transaction.service';
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
    private readonly redisCacheService: RedisCacheService,
    private readonly stripeService: StripeService,
    private readonly transactionService: TransactionService
  ) { }

  // ======== Create new appointment / booking ========
  async createAppointment(userId: string, serviceId: string, data: AppointmentDto) {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) throw new NotFoundException('User not found');

      const service = await this.serviceModel.findById(serviceId).exec();
      if (!service) throw new NotFoundException('Service not found');

      const saveData = {
        user: userId,
        service: serviceId,
        vendor: service.vendor,
        status: 'pending',
        payment_status: 'pending',
        price: service.price,
        ...data,
      };

      const appointment = await this.appointmentModel.create(saveData);

      let payment: {
        clientSecret: string;
        ephemeralKey: string;
        customer: string;
        paymentIntentId: string;
        publishableKey: string;
      } | null = null;

      if (data.payment_method === 'stripe') {
        payment = await this.stripeService.createBookingPayment(
          appointment._id.toString(),
          service.price,
          userId,
          serviceId,
          service.name,
        );

        if (!payment || !payment.clientSecret) {
          throw new InternalServerErrorException('Failed to create Stripe payment');
        }
      }

      const amount =
        Number(service.price) +
        Number(appointment.discount || 0) +
        Number(appointment.tax || 0);

      const transaction = await this.transactionService.createTransaction({
        user: userId,
        vendor: service.vendor.toString(),
        type: 'appointment',
        payment_method: data.payment_method,
        referenceType: 'Appointment',
        referenceId: appointment._id.toString(),
        amount,
        currency: 'USD',
        country: 'US',
      });

      return {
        success: true,
        message: 'Appointment created successfully',
        data: {
          appointmentId: appointment._id,
          trxID: transaction.trxID,
          payment_method: data.payment_method,
          clientSecret: payment?.clientSecret || null,
          ephemeralKey: payment?.ephemeralKey || null,
          customer: payment?.customer || null,
          publishableKey: payment?.publishableKey || null,
        },
      };
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
      await this.redisCacheService.del(`getAllSalonAppointment${exist.vendor}`);
      await this.redisCacheService.del(`getConfirmSalonAppointment${exist.vendor}`);
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

      const { keyword, name, status, payment_status } = req.query;

      let perPage: number | undefined;

      if (req.query && typeof req.query.limit === 'string') {
        perPage = parseInt(req.query.limit, 10);
      }

      // Construct the search criteria
      interface AppointmentSearchCriteria {
        name?: string;
        status?: string;
        payment_status?: string;
      }

      const searchCriteria: AppointmentSearchCriteria = {};

      if (status) {
        searchCriteria.status = status;
      }
      if (name) {
        searchCriteria.name = name;
      }
      if (payment_status) {
        searchCriteria.payment_status = payment_status;
      }

      const count = await this.appointmentModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.appointmentModel
          .find(searchCriteria)
          .populate('user', 'first_name last_name email avatar')
          .populate({
            path: 'vendor',
            select: 'name logo cover type address mobile',
            populate: {
              path: 'user',
              select: 'first_name last_name email avatar',
            },
          })
          .populate('service', 'name price duration image')
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

      await this.redisCacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get appointment / order by user ID ========
  async getAllAppointmentByUser(req: any) {
    const userId = req.user.id;
    try {
      // const cacheKey = `getAllUserAppointment${userId}`;
      // const cacheData = await this.redisCacheService.get(cacheKey);
      // if (cacheData) {
      //   return cacheData;
      // }

      const { status, payment_status } = req.query;

      let perPage: number | undefined;

      if (req.query && typeof req.query.limit === 'string') {
        perPage = parseInt(req.query.limit, 10);
      }
      interface AppointmentSearchCriteria {
        user: string;
        status?: string;
        payment_status?: string;
      }

      const searchCriteria: AppointmentSearchCriteria = { user: userId };
      if (status) {
        searchCriteria.status = status;
      }
      if (payment_status) {
        searchCriteria.payment_status = payment_status;
      }

      const count = await this.appointmentModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.appointmentModel
          .find(searchCriteria)
          .populate('user', 'first_name last_name email avatar')
          .populate({
            path: 'vendor',
            select: 'name logo cover type address mobile',
            populate: {
              path: 'user',
              select: 'first_name last_name email avatar',
            },
          })
          .populate('service', 'name price duration image')
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
        if (status) {
          nextUrl += `&status=${status}`;
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

      // await this.redisCacheService.set(cacheKey, data, 60);

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

      const { keyword, status, payment_status } = req.query;

      let perPage: number | undefined;

      if (req.query && typeof req.query.limit === 'string') {
        perPage = parseInt(req.query.limit, 10);
      }
      interface AppointmentSearchCriteria {
        salon: string;
        name?: string;
        status?: string;
        payment_status?: string;
      }


      // Construct the search criteria
      const searchCriteria: AppointmentSearchCriteria = { salon: salonId, };
      if (keyword) {
        searchCriteria.name = keyword;
      }
      if (status) {
        searchCriteria.status = status;
      }
      if (payment_status) {
        searchCriteria.payment_status = payment_status;
      }

      const count = await this.appointmentModel.countDocuments(searchCriteria);

      const apiFeature = new ApiFeatures(
        this.appointmentModel
          .find(searchCriteria)
          .populate('user', 'first_name last_name email avatar')
          .populate({
            path: 'vendor',
            select: 'name logo cover type address mobile',
            populate: {
              path: 'user',
              select: 'first_name last_name email avatar',
            },
          })
          .populate('service', 'name price duration image')
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

      await this.redisCacheService.set(cacheKey, data, 60);

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

      await this.redisCacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }


}
