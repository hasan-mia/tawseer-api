import { NotificationModule } from '@/notification/notification.module';
import { QueueModule } from '@/queueManagement/queue.module';
import { AppointmentSchema } from '@/schemas/appointment.schema';
import { TransactionSchema } from '@/schemas/transaction.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeController } from './ stripe.controller';
import { TransactionController } from './ transaction.controller';
import { StripeService } from './stripe.service';
import { TransactionService } from './transaction.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'Transaction', schema: TransactionSchema },
      { name: 'Vendor', schema: VendorSchema },
    ]),
    NotificationModule,
    QueueModule,
  ],
  controllers: [StripeController, TransactionController],
  providers: [StripeService, TransactionService],
  exports: [StripeService, TransactionService],
})
export class PaymentModule { }
