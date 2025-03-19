import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Feature extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'Subscribe', required: true })
  subscribe: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string

  @Prop({
    enum: ['text_post', 'photo_post', 'video_post', 'chat', 'send_request', 'service'],
    required: true,
    default: 'service',
  })
  type: string

  @Prop()
  limit: number

}

export const FeatureSchema = SchemaFactory.createForClass(Feature);
