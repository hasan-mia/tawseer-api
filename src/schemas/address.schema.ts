/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
  timestamps: true,
})
export class Address extends Document {
  @Prop({ default: () => uuidv4() })
  uuid: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  address_one: string;

  @Prop()
  address_two: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  post_code: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  country: string;

  @Prop({ type: Boolean, default: false })
  is_default: boolean;

  @Prop({ type: Boolean, default: false })
  is_deleted: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

AddressSchema.pre<Address>('save', async function (next) {
  if (this.is_default) {
    const model = this.constructor as Model<Address>;
    await model.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { is_default: false } }
    );
  }
  next();
});