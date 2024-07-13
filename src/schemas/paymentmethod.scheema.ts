import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { User } from './user.schema';

@Schema({
  timestamps: true,
})
export class PaymentMethod extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ required: true })
  amount: number;

  @Prop({ enum: ['card', 'bank', 'mobile_bank'] })
  accountType: string;

  @Prop({ required: true })
  accountHolderName: string;

  @Prop({ required: true })
  accountNumber: string;

  @Prop({ required: true })
  bankName: string;

  @Prop()
  cardNumber?: string;

  @Prop()
  expirationDate?: Date;

  @Prop()
  cvv?: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);
