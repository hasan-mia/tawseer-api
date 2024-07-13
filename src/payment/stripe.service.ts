import Stripe from 'stripe';
import { StripePaymentDto } from './dto/stripepayment.dto';

export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_API_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }

  async processPayment(id: string, data: StripePaymentDto): Promise<any> {
    try {
      // Use Stripe to create a payment
      const paymentIntent = await this.stripe.paymentIntents.create(data);

      return paymentIntent;
      // Use Stripe to create an invoice item

      //   const invoiceItemData = {
      //     ...data,
      //     customer: id,
      //   };
      //   const invoiceItem =
      //     await this.stripe.invoiceItems.create(invoiceItemData);

      //   // Use Stripe to create an invoice
      //   const invoiceData = {
      //     ...data,
      //     customer: id,
      //     payment_intent: paymentIntent.id,
      //     auto_advance: true,
      //   };
      //   const invoice = await this.stripe.invoices.create(invoiceData);

      //   // Return both the payment intent and the invoice object
      //   return { paymentIntent, invoice, invoiceItem };

      // Return the payment intent object
      return paymentIntent;
    } catch (error) {
      throw new Error(`Failed to process payment: ${error.message}`);
    }
  }
}
