/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Usage extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  user: Types.ObjectId;

  @Prop({ type: String, required: false })
  ip: string

  @Prop({ type: String, required: false })
  mac: string

  @Prop({
    enum: ['text_post', 'photo_post', 'video_post', 'chat', 'send_request', 'service'],
    required: true,
    default: 'service',
  })
  type: string

  @Prop({ type: Number, default: 0 })
  limit: number

}

export const UsageSchema = SchemaFactory.createForClass(Usage);
