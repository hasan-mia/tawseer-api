/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { getPublicIdFromUrl } from '@/helpers/uniqID.helper';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Photo } from 'src/schemas/photo.schema';
import { Video } from 'src/schemas/video.schema';
import { RedisCacheService } from '../rediscloud.service';
import { User } from '../schemas/user.schema';

@Injectable()
export class UploadService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Photo.name)
    private photoModel: Model<Photo>,
    @InjectModel(Video.name)
    private videoModel: Model<Video>,
    private readonly redisCacheService: RedisCacheService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // ======== Create photos ========
  async createPhotos(id: string, data: any) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const finalData = {
        user: id,
        urls: data,
      }

      const saveData = await this.photoModel.create(finalData);

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

  // ======== Create video ========
  async createVideo(id: string, data: any) {
    try {
      const user = await this.userModel.findById(id).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const finalData = {
        user: id,
        urls: data,
      }

      const saveData = await this.videoModel.create(finalData);

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

  // ======== Get all photos ========
  async getAllPhotos() {
    try {
      const data = await this.photoModel.find().exec();

      const result = {
        success: true,
        message: 'Photos retrieved successfully',
        data: data,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get all videos ========
  async getAllVideos() {
    try {
      const data = await this.videoModel.find().exec();

      const result = {
        success: true,
        message: 'Videos retrieved successfully',
        data: data,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Delete photos ========
  async deletePhotos(id: string) {
    try {
      if (!isValidObjectId(id)) {
        throw new BadRequestException('Invalid ID format');
      }
      const data = await this.photoModel.findById(id).exec();

      if (!data) {
        throw new NotFoundException('Photos not found');
      }

      if (data && data.urls.length > 0) {
        for (const url of data.urls) {
          const publicId = getPublicIdFromUrl(url);
          if (publicId) {
            await this.cloudinaryService.deleteFile(publicId);
          }
        }
      }

      await this.photoModel.findByIdAndDelete(id).exec();

      const result = {
        success: true,
        message: 'Photos deleted successfully',
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Delete photos ========
  async deleteVideos(id: string) {
    try {
      if (!isValidObjectId(id)) {
        throw new BadRequestException('Invalid ID format');
      }
      const data = await this.videoModel.findById(id).exec();

      if (!data) {
        throw new NotFoundException('Photos not found');
      }

      if (data && data.urls.length > 0) {
        for (const url of data.urls) {
          const publicId = getPublicIdFromUrl(url);
          if (publicId) {
            await this.cloudinaryService.deleteFile(publicId);
          }
        }
      }

      await this.videoModel.findByIdAndDelete(id).exec();

      const result = {
        success: true,
        message: 'Photos deleted successfully',
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

}
