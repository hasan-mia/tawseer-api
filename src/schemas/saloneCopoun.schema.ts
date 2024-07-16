/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Coupon extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Salon' })
  salon: Types.ObjectId;

  @Prop({ type: String, unique: true })
  code: string

  @Prop({ type: Number, required: true, min: 0 })
  discount: number

  @Prop({
    required: true,
    enum: ['percentage', 'amount'],
  })
  type: string;

  @Prop({ type: Date, required: true })
  expired: Date;
}

export const CouponFollowSchema = SchemaFactory.createForClass(Coupon);
