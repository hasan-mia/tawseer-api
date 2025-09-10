/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AppointmentService } from './appointment.service';
import { AppointmentDto } from './dto/appointment.dto';

@Controller('appointment')
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) { }

  // ======== Create appointment ========
  @Post(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createAppointment(@Body() data: AppointmentDto, @Request() req) {
    const userId = req.user.id;
    const serviceId = req.params.id;
    return this.appointmentService.createAppointment(userId, serviceId, data);
  }

  // ======== Get all appointment ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllAppointment(@Request() req) {
    return this.appointmentService.getAllAppointment(req);
  }

  // ======== Get all appointment by user ID ========
  @Get('all/my')
  @HttpCode(HttpStatus.OK)
  async getAllAppointmentByUser(@Request() req) {
    return this.appointmentService.getAllAppointmentByUser(req);
  }

  // ======== Get all appointment by salon ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAllAppointmentBySalon(@Request() req) {
    return this.appointmentService.getAllAppointmentBySalon(req);
  }

  // ======== Get confirm appointment by salon ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getConfirmAppointmentBySalon(@Request() req) {
    return this.appointmentService.getConfirmAppointmentBySalon(req);
  }
}
