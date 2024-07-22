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
import { UserDto } from './dto/user.dto';
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
    @Body() data: UserDto, @Request() req
  ) {
    const user = req.user;
    return this.userService.updateProfile(user.id, data);

  }

  // ======== Update user role by admin ========
  @Put('role/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateUserRole(@Param() id: string, @Body() data: UserDto) {
    return this.userService.updateUserRole(id, data);
  }

  // ======== Get All User by admin ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getUserInfo(@Request() req) {
    return this.userService.allUser(req);
  }

  // ======== Get user info by ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAllUser(@Request() req) {
    const id = req.params.id;
    return this.userService.allUser(id);
  }
}
