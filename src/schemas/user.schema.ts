import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class User extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ required: true })
  first_name: string;

  @Prop({ required: true })
  last_name: string;

  @Prop({ unique: true })
  mobile: string;

  @Prop({ unique: true })
  email: string;

  @Prop({ nullable: true })
  username: string;

  @Prop({ nullable: true })
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

  @Prop({ enum: ['male', 'female', 'other'], required: true })
  gender: string;

  @Prop({ enum: ['user', 'vendor', 'editor', 'admin', 'super_admin'], required: true })
  role: string;

  @Prop({ default: null })
  id_card_front_image: string;

  @Prop({ default: null })
  id_card_back_image: string;

  @Prop({ enum: ['pending', 'approved', 'rejected'], required: true })
  id_card_verification_status: string;

  @Prop({ default: false })
  is_verified: boolean;

  @Prop({ nullable: true })
  fcmtoken: string;

  @Prop({ type: [String], default: [] })
  location: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  parent: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  children: string[];

  @Prop({ type: Number })
  point: number;

  @Prop({ nullable: true })
  refresh_token: string;
  
  // @Prop({ type: Types.ObjectId, ref: 'Profile' })
  // profile: Profile;
}

export const UserSchema = SchemaFactory.createForClass(User);
