/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Friend extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  fromUser: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  toUser: Types.ObjectId;

  @Prop({ enum: ['pending', 'accepted', 'rejected'] })
  status: string;
}

export const FriendSchema = SchemaFactory.createForClass(Friend);
