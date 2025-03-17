/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ServiceDto, UpdateServiceDto } from './dto/service.dto';
import { ServiceService } from './service.service';

@Controller('services')
export class ServiceController {
  constructor(private serviceService: ServiceService) { }

  // ======== Create service ========
  @Post('')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createService(@Body() data: ServiceDto, @Request() req) {
    const user = req.user;
    return this.serviceService.createService(user.id, data);
  }

  // ======== Update service ========
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateService(@Param('id') id: string, @Body() data: UpdateServiceDto, @Request() req) {
    const user = req.user;
    return this.serviceService.updateService(user.id, id, data);
  }

  // ======== Get all service ========
  @Get('')
  @HttpCode(HttpStatus.OK)
  async getAllService(@Request() req) {
    return this.serviceService.getAllService(req);
  }

  // ======== Get service details by id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getServiceDetails(@Request() req) {
    const id = req.params.id;
    return this.serviceService.getServiceDetails(id);
  }

  // ======== Get service details by id ========
  @Get('vendor/:id')
  @HttpCode(HttpStatus.OK)
  async getAllServiceByVendorId(@Param('id') id: string, @Request() req) {
    return this.serviceService.getAllServiceByVendorId(id, req);
  }
}
