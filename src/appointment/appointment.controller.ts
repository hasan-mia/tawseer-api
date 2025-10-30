/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AppointmentService } from './appointment.service';
import { AppointmentDto } from './dto/appointment.dto';

@Controller('appointment')
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) { }

  // ======== Create appointment / booking ========
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
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getAllAppointmentByUser(@Request() req) {
    return this.appointmentService.getAllAppointmentByUser(req);
  }

  // ======== Get all appointment by salon ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAllAppointmentByVendor(@Request() req) {
    return this.appointmentService.getAllAppointmentBySalon(req);
  }

  // ======== Get confirm appointment by vendor ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getConfirmAppointmentByVendor(@Request() req) {
    return this.appointmentService.getConfirmAppointmentBySalon(req);
  }


  // Start appointment (Vendor action)
  @Patch('start/:id')
  @UseGuards(JwtAuthGuard)
  async startAppointment(@Request() req) {
    return this.appointmentService.startAppointment(
      req.user.id,
      req.params.id,
    );
  }

  // Complete appointment (Vendor action)
  @Patch('complete/:id')
  @UseGuards(JwtAuthGuard)
  async completeAppointment(@Request() req) {
    return this.appointmentService.completeAppointment(
      req.user.id,
      req.params.id,
    );
  }

  // Cancel appointment (Customer action)
  @Patch('cancel/:id')
  @UseGuards(JwtAuthGuard)
  async cancelAppointment(@Request() req) {
    return this.appointmentService.cancelAppointment(
      req.user.id,
      req.params.id,
    );
  }

}

