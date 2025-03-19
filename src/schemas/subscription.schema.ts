/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Subscription extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: String, required: true })
  name: string

  @Prop({
    enum: ['free', 'starter', 'premium'],
    required: true,
    default: 'pending',
  })
  type: string

  @Prop({
    type: Object,
    required: true,
    validate: {
      validator: function (v) {
        return v && typeof v.amount_monthly === 'number' && typeof v.amount_yearly === 'number';
      },
      message: 'bn must have amount_monthly and amount_yearly as numbers',
    },
  })
  bd: {
    amount_monthly: number;
    amount_yearly: number;
  };

  @Prop({
    type: Object,
    required: true,
    validate: {
      validator: function (v) {
        return v && typeof v.amount_monthly === 'number' && typeof v.amount_yearly === 'number';
      },
      message: 'global must have amount_monthly and amount_yearly as numbers',
    },
  })
  global: {
    amount_monthly: number;
    amount_yearly: number;
  };

  @Prop({ type: Boolean, default: false })
  isDiscount: boolean

  @Prop({ type: Types.ObjectId, ref: 'Coupon' })
  coupon: Types.ObjectId;

}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
