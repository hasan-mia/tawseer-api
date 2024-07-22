/* eslint-disable prettier/prettier */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    private readonly redisCacheService: RedisCacheService
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
        photos: data,
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
        videos: data,
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
}
