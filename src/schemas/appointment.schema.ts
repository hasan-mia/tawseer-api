import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Appointment extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service: Types.ObjectId;

  @Prop({ type: Date, required: true })
  appointment_time: Date

  @Prop({
    enum: ['pending', 'confirm', 'ongoing', 'completed'],
    required: true,
    default: 'pending',
  })
  status: string

  @Prop({
    enum: ['pending', 'processing', 'success', 'refund'],
    required: true,
    default: 'pending',
  })
  payment_status: string

  @Prop({
    enum: ['cash_on', 'stripe', 'paypal', 'bkash', 'nagad', 'paytm', 'bank_transfer', 'wallet'],
    required: true,
    default: 'cash_on',
  })
  payment_method: string;

  @Prop({ type: Number, required: true })
  price: number

  @Prop({ type: Number, required: true, default: 0 })
  tax: number

  @Prop({ type: Number, required: false, default: 0 })
  discount: number

  @Prop({ type: Types.ObjectId, ref: 'Coupon', required: false })
  coupon?: Types.ObjectId;

  @Prop({ type: Number, required: false })
  chargeAmount: number;

  @Prop({ enum: ['fixed', 'percentage'], default: 'fixed' })
  chargeType: string;

}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
