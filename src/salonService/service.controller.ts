/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ServiceDto } from './dto/service.dto';
import { ServiceService } from './service.service';

@Controller('service')
export class ServiceController {
  constructor(private serviceService: ServiceService) { }

  // ======== Create service ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createService(@Body() data: ServiceDto, @Request() req) {
    const user = req.user;
    return this.serviceService.createService(user.id, data);
  }

  // ======== Update service ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateService(@Body() data: ServiceDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id;
    return this.serviceService.updateService(user.id, postId, data);
  }

  // ======== Get all service ========
  @Get('all')
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
  @Get('all/:id')
  @HttpCode(HttpStatus.OK)
  async getAllServiceBySalonId(@Request() req) {
    return this.serviceService.getAllServiceBySalonId(req);
  }
}
