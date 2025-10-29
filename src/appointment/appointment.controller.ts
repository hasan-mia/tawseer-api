/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

  // ======== Get confirm appointment by salon ID ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getConfirmAppointmentByVendor(@Request() req) {
    return this.appointmentService.getConfirmAppointmentBySalon(req);
  }


  // *** NEW: Start appointment (Vendor action) ***
  @Patch('start/:id')
  async startAppointment(@Request() req, @Param('id') appointmentId: string) {
    // Assuming vendor ID is in req.user.vendorId
    // You may need to adjust based on your auth structure
    return this.appointmentService.startAppointment(
      req.user.id,
      appointmentId,
    );
  }

  // *** NEW: Complete appointment (Vendor action) ***
  @Patch('complete/:id')
  async completeAppointment(@Request() req, @Param('id') appointmentId: string) {
    return this.appointmentService.completeAppointment(
      req.user.id,
      appointmentId,
    );
  }

  // *** NEW: Cancel appointment (Customer action) ***
  @Patch('cancel/:id')
  async cancelAppointment(@Request() req, @Param('id') appointmentId: string) {
    return this.appointmentService.cancelAppointment(
      req.user.id,
      appointmentId,
    );
  }

}

