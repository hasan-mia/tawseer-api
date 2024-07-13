import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { response } from 'express';
import { Model } from 'mongoose';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';
import { UserProfileDto } from './dto/userprofile.dto';
import { UserStatusDto } from './dto/userstatus.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,

    private readonly redisCacheService: RedisCacheService,
  ) {}

  // ======== Update User Profile ========
  async updateProfile(id: string, avatar: any, data: UserProfileDto) {
    const { first_name, last_name, email, mobile, password, username } = data;
    // Find the user by ID
    const user = await this.userModel
      .findById(id)
      .where('user_type')
      .equals(0)
      .where('role')
      .equals('user')
      .populate('profile')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      // Update user's email, mobile and password if provided
      if (email !== undefined && email !== null) {
        user.email = email;
      }
      if (mobile !== undefined && mobile !== null) {
        user.mobile = mobile;
      }
      if (username !== undefined && username !== null) {
        user.username = username;
      }
      if (password !== undefined && password !== null) {
        const salt = await bcrypt.genSalt(10);
        const hanshPass = await bcrypt.hash(password, salt);
        user.password = hanshPass;
      }
      await user.save();

      // Populate the updated user object with the profile information
      const updatedUser = await this.userModel
        .findById(id)
        .select({ __v: 0, password: 0, otp: 0 })
        .populate({
          path: 'profile',
          select: '-__v',
        })
        .exec();

      if (!updatedUser) {
        throw new NotFoundException('Updated user not found');
      }

      // remove caching
      await this.redisCacheService.del('getAllUserByAdmin');
      await this.redisCacheService.del('getAllRiderByAdmin');
      await this.redisCacheService.del(`myInfo${id}`);

      return updatedUser;
    } catch (error) {
      // Check if the error is a duplicate key error
      if (error.code === 11000) {
        return { error: 'Mobile number already exist' };
      }
      // Handle errors
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  // ======== Get All User by admin ========
  async alluser() {
    try {
      const cacheKey = 'getAllUserByAdmin';
      const cacheData = await this.redisCacheService.get(cacheKey);
      if (cacheData) {
        return cacheData;
      }
      const users = await this.userModel
        .find({ user_type: 0 })
        .select({ __v: 0, password: 0, otp: 0 })
        .populate('profile')
        .exec();

      // save data into redis
      await this.redisCacheService.set(cacheKey, response, 1800);

      return users;
    } catch (error) {
      throw new Error(`Failed to retrieve users: ${error.message}`);
    }
  }

  // ========= Change user Varification status ======
  async changeVarifyStatus(id: string, data: UserStatusDto) {
    try {
      const exists = await this.userModel.findByIdAndUpdate(id).exec();

      if (!exists) {
        throw new NotFoundException('Use not found');
      }
      await this.userModel
        .updateOne({ _id: id }, { isVarified: data.isVarified })
        .exec();

      // remove caching
      await this.redisCacheService.del('getAllUserByAdmin');
      await this.redisCacheService.del('getAllRiderByAdmin');
      await this.redisCacheService.del(`myInfo${id}`);

      return await this.userModel
        .findById(id)
        .select({ __v: 0, password: 0, otp: 0 })
        .populate('profile')
        .exec();
    } catch (error) {
      throw new Error(`Failed to retrieve users: ${error.message}`);
    }
  }

  // ========= Change user Ban status ======
  async changeBanStatus(id: string, data: UserStatusDto) {
    try {
      const exists = await this.userModel.findByIdAndUpdate(id).exec();

      if (!exists) {
        throw new NotFoundException('Use not found');
      }
      await this.userModel.updateOne({ _id: id }, { isBan: data.isBan }).exec();

      // remove caching
      await this.redisCacheService.del('getAllUserByAdmin');
      await this.redisCacheService.del('getAllRiderByAdmin');
      await this.redisCacheService.del(`myInfo${id}`);

      return await this.userModel
        .findById(id)
        .select({ __v: 0, password: 0, otp: 0 })
        .populate('profile')
        .exec();
    } catch (error) {
      throw new Error(`Failed to retrieve users: ${error.message}`);
    }
  }

  // ========= Change user Active status ======
  async changeActiveStatus(id: string, data: UserStatusDto) {
    try {
      const exists = await this.userModel.findByIdAndUpdate(id).exec();

      if (!exists) {
        throw new NotFoundException('Use not found');
      }
      await this.userModel
        .updateOne({ _id: id }, { isActive: data.isActive })
        .exec();

      // remove caching
      await this.redisCacheService.del('getAllUserByAdmin');
      await this.redisCacheService.del('getAllRiderByAdmin');
      await this.redisCacheService.del(`myInfo${id}`);

      return await this.userModel
        .findById(id)
        .select({ __v: 0, password: 0, otp: 0 })
        .populate('profile')
        .exec();
    } catch (error) {
      throw new Error(`Failed to retrieve users: ${error.message}`);
    }
  }
}
