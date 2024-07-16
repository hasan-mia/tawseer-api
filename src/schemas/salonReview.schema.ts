/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Review extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Salon', required: true })
  salon: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service: Types.ObjectId;

  @Prop({
    enum: ['salon', 'service'],
    required: true,
    default: 'service',
  })
  type: string

  @Prop({ type: Boolean, required: true })
  rating: number

  @Prop({ type: String, required: true })
  message: string

  @Prop({ type: Types.ObjectId, ref: 'Coupon' })
  coupon: Types.ObjectId;

}

export const ReviewSchema = SchemaFactory.createForClass(Review);
