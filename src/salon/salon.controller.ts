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
import { SalonDto } from './dto/salon.dto';
import { SalonService } from './salon.service';

@Controller('salon')
export class SalonController {
  constructor(
    private salonService: SalonService,
  ) { }

  // ======== Update Salon ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSalon(
    @Body() data: SalonDto, @Request() req
  ) {
    const user = req.user;
    return this.salonService.createSalon(user.id, data);

  }

  // ======== Update Salon ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateSalon(
    @Body() data: SalonDto, @Request() req
  ) {
    const user = req.user;
    const salonId = req.params.id;
    return this.salonService.updateSalon(user.id, salonId, data);

  }

  // ======== Get all salon ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllSalon(@Request() req) {
    return this.salonService.getAllSalon(req);
  }

  // ======== Get salon info by id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSalonInfo(@Request() req) {
    const id = req.params.id;
    return this.salonService.getSalonInfo(id);
  }


}
