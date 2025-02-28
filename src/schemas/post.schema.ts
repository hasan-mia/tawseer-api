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

  @Prop({ enum: ['text', 'photo', 'video'], default: 'text' })
  type: string;

  @Prop({ type: String, required: false })
  text: string;

  @Prop({ type: [Types.ObjectId], ref: 'Photo', required: false })
  photos: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Video', required: false })
  videos: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  views: number;

  @Prop({ type: Number, default: 0 })
  shares: number;

  @Prop({ type: Boolean, default: false })
  is_deleted: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);
