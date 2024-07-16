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
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Salon', required: true })
  salon: Types.ObjectId;

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

}

export const ServiceSchema = SchemaFactory.createForClass(Service);
