import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class User extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop()
  first_name: string;

  @Prop()
  last_name: string;

  @Prop()
  mobile: string;

  @Prop({ unique: true })
  email: string;

  @Prop()
  username: string;

  @Prop()
  password: string;

  @Prop()
  avatar: string;

  @Prop()
  cover: string;

  @Prop()
  otp: number;

  @Prop()
  bio: string;

  @Prop({ type: Date })
  birth_date: Date;

  @Prop({ enum: ['male', 'female', 'other'] })
  gender: string;

  @Prop({
    enum: ['user', 'vendor', 'editor', 'admin', 'super_admin'],
    required: true,
    default: 'user',
  })
  role: string;

  @Prop()
  id_card_front_image: string;

  @Prop()
  id_card_back_image: string;

  @Prop({
    enum: ['pending', 'approved', 'rejected'],
    required: true,
    default: 'pending',
  })
  id_card_verification_status: string;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop()
  fcmtoken: string;

  @Prop({ type: [String], default: [] })
  location: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  parent: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  children: string[];

  @Prop({ type: Number })
  point: number;

  @Prop()
  refresh_token: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
