import { RedisCacheService } from '@/rediscloud.service';
import { User } from '@/schemas/user.schema';
import { Vendor } from '@/schemas/vendor.schema';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Vendor.name)
    private vendorModel: Model<Vendor>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Update User Profile ========
  async updateProfile(id: string, data: UserDto) {

    try {

      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (data?.is_verified) {
        throw new BadRequestException("You can't update varify status");
      }

      if (data?.point) {
        throw new BadRequestException("You can't update point");
      }

      if (data?.subscribe_package) {
        throw new BadRequestException("You can't update pacakge");
      }

      if (data?.id_card_verification_status) {
        throw new BadRequestException("You can't update Id varification status");
      }

      const updatedUserData = { ...user.toObject(), ...data };

      const updatedUser = await this.userModel.findByIdAndUpdate(id, updatedUserData, { new: true, upsert: true });

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedUser,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ========= Change user Verification status ======
  async changeVerifyStatus(id: string, data: UserDto) {
    try {
      const user = await this.userModel.findByIdAndUpdate(id).exec();

      if (!user) {
        throw new NotFoundException('Use not found');
      }
      const updatedData = await this.userModel
        .updateOne({ _id: id }, { is_verified: data.is_verified })
        .exec();


      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedData
      }

      return result;

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get All User by admin ========
  async allUser(req: any) {
    try {

      const { keyword, gender, role, is_disabled, is_deleted, limit, page } = req.query;

      let perPage: number = 10;
      if (limit && !isNaN(parseInt(limit, 10))) {
        perPage = parseInt(limit, 10);
      }

      const currentPage = page && !isNaN(parseInt(page, 10)) ? parseInt(page, 10) : 1;
      const skip = (currentPage - 1) * perPage;

      const searchCriteria: any = {};

      if (keyword) {
        searchCriteria.$or = [
          { first_name: { $regex: keyword, $options: 'i' } },
          { last_name: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } },
          { mobile: { $regex: keyword, $options: 'i' } },
          { username: { $regex: keyword, $options: 'i' } },
        ];
      }

      if (gender) {
        searchCriteria.gender = gender;
      }

      if (role) {
        searchCriteria.role = role;
      }

      if (is_disabled) {
        searchCriteria.is_disabled = is_disabled;
      }

      if (is_deleted) {
        searchCriteria.is_deleted = is_deleted;
      }

      // Count total users matching the search criteria
      const count = await this.userModel.countDocuments(searchCriteria);

      // Get paginated user data
      const result = await this.userModel
        .find(searchCriteria)
        .select('-__v -password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage);

      // Calculate total pages
      const totalPages = Math.ceil(count / perPage);

      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (currentPage < totalPages) {
        nextPage = currentPage + 1;
        nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
        if (keyword) nextUrl += `&keyword=${keyword}`;
        if (gender) nextUrl += `&gender=${gender}`;
        if (role) nextUrl += `&role=${role}`;
        if (is_disabled) nextUrl += `&is_disabled=${is_disabled}`;
        if (is_deleted) nextUrl += `&is_deleted=${is_deleted}`;
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

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  // ======== Get user info by ID ========
  async getUserInfo(id: string) {
    try {

      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let data: any = user.toObject();

      if (user.role === 'vendor') {
        const vendorInfo = await this.vendorModel.findOne({ user: id }).select('name logo cover type mobile slug')
        data.vendorInfo = vendorInfo
      }

      const result = {
        success: true,
        message: 'User found successfully',
        data,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }



  // =================================================//
  //                  Admin Dashboard                 //
  // =================================================//

  // ========= Change user info ======
  async updateUserInfo(id: string, data: UserDto) {
    try {
      const user = await this.userModel.findOne({ _id: id }).exec();

      if (!user) {
        throw new NotFoundException('Use not found');
      }

      const updatedUserData = { ...user.toObject(), ...data };

      const updatedData = await this.userModel.findByIdAndUpdate(id, updatedUserData, { new: true, upsert: true });

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedData
      }

      return result

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


}
