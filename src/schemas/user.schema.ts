/* eslint-disable prettier/prettier */
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

  @Prop({
    enum: ['free', 'starter', 'premium'],
    required: true,
    default: 'free',
  })
  subscribe_package: string;

  @Prop()
  nid_front: string;

  @Prop()
  nid_back: string;

  @Prop({
    enum: ['pending', 'approved', 'rejected'],
    required: true,
    default: 'pending',
  })
  id_card_verification_status: string;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop()
  fcmToken: string;

  @Prop({
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  parent: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  children: string[];

  @Prop({ type: Number })
  point: number;

  @Prop()
  refresh_token: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Friend' }], default: [] })
  friends: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  followers: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  followings: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'VendorFollow' }], default: [] })
  vendor_following: string[];

  @Prop({ type: Boolean, default: false })
  is_deleted: boolean;

  @Prop({ type: Boolean, default: false })
  is_disabled: boolean;

}

export const UserSchema = SchemaFactory.createForClass(User);
