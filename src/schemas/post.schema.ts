/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Post extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ enum: ['text', 'image', 'video'], default: 'text' })
  type: string;

  @Prop()
  text: string;

  @Prop()
  views: number;

  @Prop()
  shares: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);
