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

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false })
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: false })
  service: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: false })
  product: Types.ObjectId;

  @Prop({
    enum: ['vendor', 'product', 'service'],
    required: true,
    default: 'service',
  })
  type: string;

  @Prop({ type: Number, required: true })
  rating: number;

  @Prop({ type: String, required: true })
  message: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
