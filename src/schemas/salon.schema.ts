/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Salon extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  vendor: Types.ObjectId;

  @Prop({ required: true })
  name: string

  @Prop()
  logo: string

  @Prop()
  cover: string

  @Prop()
  address: string

  @Prop()
  phone: string

  @Prop()
  tin_certificate: string

  @Prop({ type: [String], default: [] })
  location: string[];

}

export const SalonSchema = SchemaFactory.createForClass(Salon);
