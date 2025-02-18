/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { AppointmentSchema } from 'src/schemas/salonAppointment.schema';
import { ServiceSchema } from 'src/schemas/salonService.schema';
import { UserSchema } from '../schemas/user.schema';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Appointment', schema: AppointmentSchema },
    ]),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, CloudinaryService, RedisCacheService],
  exports: [AppointmentService],
})
export class AppointmentModule { }
