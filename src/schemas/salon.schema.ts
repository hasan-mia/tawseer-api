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

  @Prop({ required: true })
  bio: string

  @Prop({ required: true })
  logo: string

  @Prop({ required: true })
  cover: string

  @Prop({ required: true })
  address: string

  @Prop({ required: true })
  mobile: string

  @Prop()
  tin_certificate: string

  @Prop({ type: Boolean, default: false })
  is_verified: string

  @Prop({ type: [String], default: [] })
  location: string[];

}

export const SalonSchema = SchemaFactory.createForClass(Salon);
