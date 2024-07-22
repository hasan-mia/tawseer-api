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
  @Put('update')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateProfile(
    @Body() data: UserProfileDto, @Request() req
  ) {
    const user = req.user;
    return this.userService.updateProfile(user.id, data);

  }

  // ======== Update user role by admin ========
  @Put('role/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  updateUserRole(@Param() id: string, @Body() data: UserProfileDto) {
    return this.userService.updateUserRole(id, data);
  }

  // ======== Get All User by admin ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  getUserInfo(@Request() req) {
    return this.userService.allUser(req);
  }

  // ======== Get user info by ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getAllUser(@Param() id: string) {
    return this.userService.allUser(id);
  }
}
