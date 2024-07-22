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
  @HttpCode(HttpStatus.ACCEPTED)
  async createSalon(
    @Body() data: SalonDto, @Request() req
  ) {
    const user = req.user;
    return this.salonService.createSalon(user.id, data);

  }

  // ======== Update Salon ========
  @Put('update')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateSalon(
    @Body() data: SalonDto, @Request() req
  ) {
    const user = req.user;
    return this.salonService.updateSalon(user.id, data);

  }

  // ======== Get all salon ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  getAllSalon(@Request() req) {
    return this.salonService.getAllSalon(req);
  }

  // ======== Get salon info by id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getSalonInfo(@Param() id) {
    return this.salonService.getSalonInfo(id);
  }


}
