import { Appointment } from '@/schemas/appointment.schema';
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
import { Model } from 'mongoose';
import Stripe from 'stripe';

@Controller('stripe')
export class StripeController {
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<Appointment>,
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
      });
    }

    res.json({ received: true });
  }
}