/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { StripeService } from '@/payment/stripe.service';
import { TransactionService } from '@/payment/transaction.service';
import { RedisCacheService } from '@/rediscloud.service';
import { AppointmentSchema } from '@/schemas/appointment.schema';
import { ServiceSchema } from '@/schemas/service.schema';
import { TransactionSchema } from '@/schemas/transaction.schema';
import { UserSchema } from '@/schemas/user.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
