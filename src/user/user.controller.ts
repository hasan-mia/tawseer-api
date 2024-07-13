import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/role.guard';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { UserProfileDto } from './dto/userprofile.dto';
import { UserService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    private userService: UserService,
    private cloudinaryService: CloudinaryService,
  ) {}

  // ======== Update User Profile ========
  @Put('update-profile')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfile(
    @Body() data: UserProfileDto,
    @UploadedFile() avatar: Express.Multer.File,
    @Request() req,
  ) {
    const user = req.user;

    try {
      // If image is not provided in the request, set it to null
      const uploadedImage = avatar
        ? await this.cloudinaryService.uploadImage(avatar)
        : null;
      return this.userService.updateProfile(user.id, uploadedImage, data);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ======== Get All User by admin ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  getAllUser() {
    return this.userService.alluser();
  }

  // // ========Image upoload with cloudinary========
  // @Post('cloudinary-upload')
  // @UseInterceptors(FileInterceptor('image'))
  // async uploadImage(@UploadedFile() image: Express.Multer.File) {
  //   try {
  //     const uploadedImage = await this.cloudinaryService.uploadImage(image);
  //     return { success: true, data: uploadedImage };
  //   } catch (error) {
  //     return { success: false, error: error.message };
  //   }
  // }

  // // ========Image upoload with multer========

  // @Post('multer-upload')
  // @HttpCode(HttpStatus.CREATED)
  // @UseInterceptors(FileInterceptor('image', ImageUploadOptions))
  // imageUPload(@UploadedFile() image: Express.Multer.File) {
  //   return image;
  // }
}
