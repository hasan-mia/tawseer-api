/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Reaction extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({
    required: true,
    enum: ['like', 'love', 'haha', 'care', 'sad', 'angry'],
  })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: false })
  post: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment', required: false })
  comment: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Reply', required: false })
  reply: Types.ObjectId;

}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);
