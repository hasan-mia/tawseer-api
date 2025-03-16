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
import { VendorDto } from './dto/vendor.dto';
import { VendorService } from './vendor.service';
import { updateVendor } from './dto/updateVendor.dto';

@Controller('vendors')
export class VendorController {
  constructor(
    private vendorService: VendorService,
  ) { }

  // ======== Update Vendor ========
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

  // ======== Delete Vendor by id ========
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async deleteVendor(@Param('id') id: string) {
    return this.vendorService.deleteVendor(id);
  }


}
