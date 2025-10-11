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

import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/role.guard';
import { Roles } from '@/auth/roles.decorator';
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

  // ======== Find nearby vendors ========
  @Get('nearby')
  @HttpCode(HttpStatus.OK)
  async getNearbyVendors(@Request() req) {
    return this.vendorService.findNearbyVendors(req);
  }

  // ======== Find nearby vendors by map data========
  @Get('map-data')
  @HttpCode(HttpStatus.OK)
  async getMapData(@Request() req) {
    const { latitude, longitude, radius = 5000 } = req.query;

    const vendors = await this.vendorService.findNearbyVendors(req);

    return {
      center: { latitude, longitude },
      vendors: vendors.map(vendor => ({
        id: vendor._id,
        uuid: vendor.uuid,
        name: vendor.name,
        type: vendor.type,
        address: vendor.address,
        rating: vendor.rating,
        coordinates: {
          latitude: vendor.location.coordinates[1],
          longitude: vendor.location.coordinates[0],
        },
        logo: vendor.logo,
        isOpen: this.vendorService.isVendorOpen(vendor),
        queue: vendor.queue,
      })),
    };
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


}
