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
  constructor(private salonService: ServiceService) { }

  // ======== Create service ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createService(@Body() data: ServiceDto, @Request() req) {
    const user = req.user;
    return this.salonService.createService(user.id, data);
  }

  // ======== Update service ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateService(@Body() data: ServiceDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id;
    return this.salonService.updateService(user.id, postId, data);
  }

  // ======== Get all service ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllService(@Request() req) {
    return this.salonService.getAllService(req);
  }

  // ======== Get service details by id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getServiceDetails(@Request() req) {
    const id = req.params.id;
    return this.salonService.getServiceDetails(id);
  }

  // ======== Get service details by id ========
  @Get('all/:id')
  @HttpCode(HttpStatus.OK)
  async getAllServiceBySalonId(@Request() req) {
    return this.salonService.getAllServiceBySalonId(req);
  }
}
