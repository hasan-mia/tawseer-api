/* eslint-disable prettier/prettier */
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { restructureVideo } from '@/helpers/restructureVideo.helper';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private cloudinaryService: CloudinaryService
  ) { }

  // ========Single image upload ========
  @Post('image-upload')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(@UploadedFile() image: Express.Multer.File) {
    try {
      const uploadedImage = await this.cloudinaryService.uploadImage(image);
      return { success: true, data: uploadedImage.secure_url };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  //========= Multiple image upload ==========//
  @Post('images-upload')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 5 }]))
  async uploadImages(
    @UploadedFiles() files: { images?: Express.Multer.File[] },
    @Request() req
  ) {
    try {
      const user = req.user;
      const data = [];

      if (files.images?.length > 0) {
        for (const file of files.images) {
          const result = await this.cloudinaryService.uploadImage(file);
          data.push(result.secure_url);
        }
      }

      return this.uploadService.createPhotos(user.id, data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ======== Multiple image upload by name========
  @Post('multiple-upload')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'nid_front', maxCount: 1 },
      { name: 'nid_back', maxCount: 1 },
      { name: 'date_of_birth', maxCount: 1 },
      { name: 'passport', maxCount: 1 },
      { name: 'driving_license', maxCount: 1 },
    ])
  )
  async uploadMultipleImages(
    @UploadedFiles()
    files: {
      nid_front?: Express.Multer.File[];
      nid_back?: Express.Multer.File[];
      date_of_birth?: Express.Multer.File[];
      passport?: Express.Multer.File[];
      driving_license?: Express.Multer.File[];
    }
  ) {
    try {
      const data = {};
      for (const key of Object.keys(files)) {
        if (files[key]?.length > 0) {
          const result = await this.cloudinaryService.uploadImage(
            files[key][0]
          );
          data[key] = result.secure_url;
        } else {
          data[key] = null;
        }
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Upload video
  @Post('video-upload')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'video', maxCount: 1 }]))
  async uploadVideo(
    @UploadedFiles() files: { video?: Express.Multer.File[] },
    @Request() req
  ) {
    try {
      const user = req.user;

      if (files.video?.length > 0) {
        const result = await this.cloudinaryService.uploadVideo(files.video[0]);
        const urls = result.eager.map(
          (transformation) => transformation.secure_url
        );
        const data = restructureVideo(urls);

        return this.uploadService.createVideo(user.id, data);
      }
      return { success: false, error: 'No video file uploaded' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ======== Get all photo ========
  @Get('photos')
  @HttpCode(HttpStatus.OK)
  async getAllPhotos() {
    return this.uploadService.getAllPhotos();
  }

  // ======== Get all video ========
  @Get('videos')
  @HttpCode(HttpStatus.OK)
  async getAllVideos() {
    return this.uploadService.getAllVideos();
  }

  // ======== Delete photos ========
  @Delete('photos/:id')
  @HttpCode(HttpStatus.OK)
  async deletePhotos(@Request() req) {
    const photoId = req.params.id;
    return this.uploadService.deletePhotos(photoId);
  }

  // ======== Delete videos ========
  @Delete('videos/:id')
  @HttpCode(HttpStatus.OK)
  async deleteVideos(@Request() req) {
    const videoId = req.params.id;
    return this.uploadService.deleteVideos(videoId);
  }
  // HLS upload
  // @Post('hls-upload')
  // @HttpCode(HttpStatus.OK)
  // @UseInterceptors(FileFieldsInterceptor([{ name: 'video', maxCount: 1 }]))
  // async convertAndUploadVideo(@UploadedFiles() files: { video?: Express.Multer.File[] }) {
  //   try {
  //     if (files.video?.length > 0) {
  //       const result = await this.cloudinaryService.convertAndUploadVideo(files.video[0]);
  //       return { success: true, url: result.secure_url };
  //     }
  //     return { success: false, error: 'No video file uploaded' };
  //   } catch (error) {
  //     return { success: false, error: error.message };
  //   }
  // }
}
