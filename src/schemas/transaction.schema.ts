import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema()
class UserRef {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: Types.ObjectId;

  @Prop()
  flag: string;

  @Prop()
  heading: string;
}

const UserRefSchema = SchemaFactory.createForClass(UserRef);

@Schema()
class BankDetails {
  @Prop()
  account_number: string;

  @Prop()
  bank_name: string;

  @Prop()
  branch: string;
}

const BankDetailsSchema = SchemaFactory.createForClass(BankDetails);

@Schema({
  timestamps: true,
})
export class Transaction extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: String, required: true, unique: true })
  trxID: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({
    enum: [
      'subscribe',
      'service',
      'coin',
      'product',
      'withdraw',
      'deposit',
      'refund',
      'appointment'
    ],
    required: true,
    default: 'service',
  })
  type: string;

  @Prop({
    enum: ['pending', 'success', 'canceled', 'failed', 'refunded', 'on_hold'],
    required: true,
    default: 'pending',
  })
  status: string;

  @Prop({
    enum: ['cash_on', 'stripe', 'paypal', 'bkash', 'nagad', 'paytm', 'bank_transfer', 'wallet'],
    required: true,
    default: 'cash_on',
  })
  payment_method: string;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendor: Types.ObjectId;

  @Prop({
    enum: ['Service', 'Product', 'Appointment', 'Subscription'],
    required: true,
  })
  referenceType: string;

  @Prop({ type: Types.ObjectId, required: true })
  referenceId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: Number, required: false, min: 0 })
  totalAmount: number; // amount + charge

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: [BankDetailsSchema], required: false })
  bank_details: BankDetails[];

  @Prop({ type: Date, required: false })
  expired: Date;

  @Prop({ type: Number, required: false, min: 0 })
  charge: number;

  @Prop({ type: UserRefSchema, required: false })
  sender: UserRef;

  @Prop({ type: UserRefSchema, required: false })
  receiver: UserRef;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Add indexes for better query performance
TransactionSchema.index({ trxID: 1 }, { unique: true });
TransactionSchema.index({ user: 1 });
TransactionSchema.index({ vendor: 1 });
TransactionSchema.index({ status: 1 });