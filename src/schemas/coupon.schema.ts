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

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false })
  vendor: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string

  @Prop({ type: String, required: false })
  image: string

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
  expiredAt: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
