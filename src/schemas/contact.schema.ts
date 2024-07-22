/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Contact extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  address_one: string;

  @Prop()
  address_two: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  post_code: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  country: string;

  @Prop({ type: Boolean, default: false })
  is_deleted: boolean;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
