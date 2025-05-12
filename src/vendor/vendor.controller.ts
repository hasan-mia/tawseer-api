/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards
} from '@nestjs/common';

import { RolesGuard } from '@/auth/role.guard';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { updateVendor } from './dto/updateVendor.dto';
import { VendorDto } from './dto/vendor.dto';
import { VendorService } from './vendor.service';

@Controller('vendors')
export class VendorController {
  constructor(
    private vendorService: VendorService,
  ) { }

  // ======== Create Vendor ========
  @Post('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor')
  @HttpCode(HttpStatus.CREATED)
  async createVendor(
    @Body() data: VendorDto, @Request() req
  ) {
    const user = req.user;
    return this.vendorService.createVendor(user.id, data);

  }

  // ======== Update Vendor ========
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateVendor(
    @Body() data: updateVendor, @Request() req
  ) {
    const user = req.user;
    const vendorId = req.params.id;
    return this.vendorService.updateVendor(user.id, vendorId, data);

  }

  // ======== Get all Vendor ========
  @Get('')
  @HttpCode(HttpStatus.OK)
  async getAllVendor(@Request() req) {
    return this.vendorService.getAllVendor(req);
  }

  // ======== Get Vendor info by id ========
  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  async getVendorInfo(@Param('slug') slug: string) {
    return this.vendorService.getVendorInfo(slug);
  }

  // =================================================//
  //                  Admin Dashboard                 //
  // =================================================//

  // ======== Update Vendor By Admin ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async updateVendorByAdmin(
    @Body() data: updateVendor, @Request() req) {
    const vendorId = req.params.id;
    return this.vendorService.updateVendorByAdmin(vendorId, data);

  }

  // ======== Delete Vendor by id ========
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async deleteVendor(@Param('id') id: string) {
    return this.vendorService.deleteVendor(id);
  }


  // =================================================//
  //                  Vendor Following                //
  // =================================================//

  @Post('follow-unfollow/:vendorId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async followUnfollowVendor(@Param('vendorId') vendorId: string, @Request() req) {
    const userId = req.user.id;
    return this.vendorService.followUnfollow(userId, vendorId);
  }

  @Get('is-following/:vendorId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkFollow(@Param('vendorId') vendorId: string, @Request() req) {
    const userId = req.user.id
    return await this.vendorService.isFollowing(userId, vendorId);
  }

  @Get('shop/followers/:vendorId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getFollowers(@Param('vendorId') vendorId: string, @Request() req) {
    return await this.vendorService.getFollowers(vendorId, req);
  }

  @Get('shop/followings')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getFollowing(@Request() req) {
    const userId = req.user.id
    return await this.vendorService.getFollowing(userId, req);
  }

  @Delete('shop/follower/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteFollower(@Param('id') id: string) {
    return await this.vendorService.deleteFollower(id);
  }


}
