/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/role.guard';
import { UserProfileDto } from './dto/userprofile.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(
    private userService: UserService,
  ) { }

  // ======== Update User Profile ========
  @Put('update-profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateProfile(
    @Body() data: UserProfileDto, @Request() req
  ) {
    const user = req.user;
    return this.userService.updateProfile(user.id, data);

  }

  // ======== Get All User by admin ========
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  getAllUser(@Request() req) {
    return this.userService.allUser(req);
  }

  // ======== Update user role by admin ========
  @Put('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  updateUserRole(@Body() data: UserProfileDto, @Request() req) {
    const user = req.user;
    return this.userService.updateUserRole(user.id, data);
  }

}
