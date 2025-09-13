import { Appointment } from '@/schemas/appointment.schema';
import { Transaction } from '@/schemas/transaction.schema';
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

      // Update Appointment
      await this.appointmentModel.findByIdAndUpdate(appointmentId, {
        status: 'confirm',
        payment_status: "success"
      },
        { new: true }
      );

      await this.transactionModel.findOneAndUpdate(
        { referenceId: new Types.ObjectId(appointmentId) },
        { status: "success" },
        { new: true },
      );
    }

    res.json({ received: true });
  }
}