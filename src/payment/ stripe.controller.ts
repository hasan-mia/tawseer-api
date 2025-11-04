import { QueueManagementService } from '@/queueManagement/queue.service';
import { Appointment } from '@/schemas/appointment.schema';
import { Transaction } from '@/schemas/transaction.schema';
import { QueueGateway } from '@/socket/queue.gateway';
import {
  Controller,
  Headers,
  Post,
  RawBody,
  Req,
  Res
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Request, Response } from 'express';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';

@Controller('stripe')
export class StripeController {
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<Appointment>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<Transaction>,
    private readonly queueService: QueueManagementService,
    private readonly queueGateway: QueueGateway,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_API_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  @Post('webhook')
  async handleStripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string
  ) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const appointmentId = paymentIntent.metadata.appointmentId;

      try {
        await this.appointmentModel.findByIdAndUpdate(
          appointmentId,
          {
            status: 'confirm',
            payment_status: 'success'
          },
          { new: true }
        );

        await this.transactionModel.findOneAndUpdate(
          { referenceId: new Types.ObjectId(appointmentId) },
          { status: 'success' },
          { new: true },
        );

        // Update queue based on payment
        await this.queueService.updateQueueOnPayment(appointmentId);

        // Get appointment details for broadcasting
        const appointment = await this.appointmentModel
          .findById(appointmentId)
          .lean();

        if (appointment) {
          await this.queueGateway.notifyPaymentUpdate(
            appointment.user.toString(),
            appointment.vendor.toString(),
            appointmentId,
          );

          await this.queueGateway.broadcastQueueUpdate(
            appointment.vendor.toString()
          );

        }
      } catch (error) {
        console.error('Error processing payment webhook:', error);
      }
    }

    res.json({ received: true });
  }
}