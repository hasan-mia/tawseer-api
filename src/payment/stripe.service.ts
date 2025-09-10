/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_API_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createBookingPayment(appointmentId: string, amount: number, userId: string, serviceId: string, name?: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        description: `Purchase of ${name}`,
        payment_method_types: ['card'],
        metadata: {
          appointmentId,
          userId,
          serviceId,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to create payment: ${error.message}`);
    }
  }
}
