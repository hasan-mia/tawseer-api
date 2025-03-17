/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Service extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  description: string

  @Prop()
  price: number

  @Prop()
  currency: string

  @Prop()
  duration: number

  @Prop()
  image: string

  @Prop()
  country: string

  @Prop({ type: Boolean, default: false })
  isDiscount: boolean

  @Prop({ type: Types.ObjectId, ref: 'Coupon' })
  coupon: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  is_deleted: boolean;

}

export const ServiceSchema = SchemaFactory.createForClass(Service);
