import { AppointmentSchema } from '@/schemas/appointment.schema';
import { TransactionSchema } from '@/schemas/transaction.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeController } from './ stripe.controller';
import { StripeService } from './stripe.service';
import { TransactionService } from './transaction.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'Transaction', schema: TransactionSchema },
    ]),
  ],
  controllers: [StripeController],
  providers: [StripeService, TransactionService],
  exports: [StripeService, TransactionService],
})
export class PaymentModule { }
