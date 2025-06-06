/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Reply extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  post: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment', required: true })
  comment: Types.ObjectId;

  @Prop()
  text: string;

  @Prop()
  image: string;

  @Prop({ type: Boolean, default: false })
  is_deleted: boolean;

}

export const ReplySchema = SchemaFactory.createForClass(Reply);
