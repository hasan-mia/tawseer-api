/* eslint-disable prettier/prettier */
import { StripeService } from '@/payment/stripe.service';
import { TransactionService } from '@/payment/transaction.service';
import { RedisCacheService } from '@/rediscloud.service';
import { AppointmentSchema } from '@/schemas/appointment.schema';
import { TransactionSchema } from '@/schemas/transaction.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ServiceSchema } from 'src/schemas/service.schema';
import { UserSchema } from '../schemas/user.schema';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Service', schema: ServiceSchema },
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'Transaction', schema: TransactionSchema },
    ]),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, TransactionService, CloudinaryService, RedisCacheService, StripeService],
  exports: [AppointmentService],
})
export class AppointmentModule { }
