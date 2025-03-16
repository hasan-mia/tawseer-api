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
  UseGuards
} from '@nestjs/common';

import { RolesGuard } from '@/auth/role.guard';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SalonDto } from './dto/salon.dto';
import { SalonService } from './salon.service';

@Controller('salons')
export class SalonController {
  constructor(
    private salonService: SalonService,
  ) { }

  // ======== Update Salon ========
  @Post('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor')
  @HttpCode(HttpStatus.CREATED)
  async createSalon(
    @Body() data: SalonDto, @Request() req
  ) {
    const user = req.user;
    return this.salonService.createSalon(user.id, data);

  }

  // ======== Update Salon ========
  @Put(':id')
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
  @Get('')
  @HttpCode(HttpStatus.OK)
  async getAllSalon(@Request() req) {
    return this.salonService.getAllSalon(req);
  }

  // ======== Get salon info by id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSalonInfo(@Param('id') id: string) {
    return this.salonService.getSalonInfo(id);
  }


}
