/* eslint-disable prettier/prettier */
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

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  vendor: Types.ObjectId;


  @Prop({ type: Types.ObjectId, ref: 'Salon', required: true })
  salon: Types.ObjectId;

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

  @Prop({ type: Number, required: true })
  price: number

  @Prop({ type: Number, required: false })
  discount: number

}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
