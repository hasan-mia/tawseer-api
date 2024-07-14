/* eslint-disable prettier/prettier */
import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';

import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Controller('upload')
export class UploadController {
  constructor(
    private cloudinaryService: CloudinaryService
  ) { }

  // ========Single image upload ========
  @Post('image-upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(@UploadedFile() image: Express.Multer.File) {
    try {
      const uploadedImage = await this.cloudinaryService.uploadImage(image);
      return { success: true, data: uploadedImage.url };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  //========= Multiple image upload ==========//
  @Post('images-upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 5 }]),
  )
  async uploadImages(
    @UploadedFiles() files: { images?: Express.Multer.File[] },
  ) {
    try {
      const uploadedImages = [];

      if (files.images?.length > 0) {
        for (const file of files.images) {
          const result = await this.cloudinaryService.uploadImage(file);
          uploadedImages.push(result.secure_url);
        }
      }

      return { success: true, data: uploadedImages };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ======== Multiple image upload by name========
  @Post('multiple-upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'nid_front', maxCount: 1 },
      { name: 'nid_back', maxCount: 1 },
      { name: 'date_of_birth', maxCount: 1 },
      { name: 'passport', maxCount: 1 },
      { name: 'driving_license', maxCount: 1 },
    ]),
  )
  async uploadMultipleImages(
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      nid_front?: Express.Multer.File[];
      nid_back?: Express.Multer.File[];
      date_of_birth?: Express.Multer.File[];
      passport?: Express.Multer.File[];
      driving_license?: Express.Multer.File[];
    },

  ) {
    try {
      const uploadedImages = {};
      for (const key of Object.keys(files)) {
        if (files[key]?.length > 0) {
          const result = await this.cloudinaryService.uploadImage(files[key][0]);
          uploadedImages[key] = result.url;
        } else {
          uploadedImages[key] = null;
        }
      }

      return { success: true, data: uploadedImages };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('video-upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'video', maxCount: 1 }]))
  async uploadVideo(@UploadedFiles() files: { video?: Express.Multer.File[] }) {
    try {
      if (files.video?.length > 0) {
        const result = await this.cloudinaryService.uploadVideo(files.video[0]);
        // Extracting URLs for different resolutions
        const urls = result.eager.map((transformation) => transformation.secure_url);
        return { success: true, data: urls };
      }
      return { success: false, error: 'No video file uploaded' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

}
