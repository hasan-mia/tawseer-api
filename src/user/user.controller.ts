/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Request,
  UseGuards
} from '@nestjs/common';

import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/role.guard';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(
    private userService: UserService,
  ) { }

  // ======== Update User Profile ========
  @Put('update-me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateProfile(
    @Body() data: UserDto, @Request() req
  ) {
    const user = req.user;
    return this.userService.updateProfile(user.id, data);

  }

  // ======== Update user role by admin ========
  @Put('profile-update/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async updateUserInfo(@Param('id') id: string, @Body() data: UserDto) {
    return this.userService.updateUserInfo(id, data);
  }

  // ======== Get All User ========
  @Get('')
  @HttpCode(HttpStatus.OK)
  async allUser(@Request() req) {
    return this.userService.allUser(req);
  }

  // ======== Get user info by ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserInfo(@Param('id') id: string) {
    return this.userService.getUserInfo(id);
  }
}
