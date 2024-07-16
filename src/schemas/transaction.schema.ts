/* eslint-disable prettier/prettier */
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

@Schema({
  timestamps: true,
})
export class Transaction extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: String, required: true })
  trxID: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({
    enum: ['subscribe', 'service', 'coin'],
    required: true,
    default: 'service',
  })
  type: string;

  @Prop({
    enum: ['pending', 'success', 'canceled', 'failed'],
    required: true,
    default: 'pending',
  })
  status: string;

  @Prop({
    enum: ['cash_on', 'stripe', 'paypal', 'bkash', 'nagad', 'paytm', 'bank_transfer'],
    required: true,
    default: 'cash_on',
  })
  payment_method: string;

  @Prop({ type: Types.ObjectId, ref: 'Salon' })
  salon: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  service: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: [String], required: false })
  bank_details: string[];

  @Prop({ type: Date, required: false })
  expired: Date;

  // ================For Coin usage============
  @Prop({ type: Number, required: false })
  charge: number;

  @Prop({ type: UserRefSchema, required: false })
  sender: UserRef;

  @Prop({ type: UserRefSchema, required: false })
  receiver: UserRef;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
