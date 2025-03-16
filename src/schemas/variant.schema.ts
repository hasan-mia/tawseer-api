import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Variant extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  product: Types.ObjectId;

  @Prop({ type: Map, of: String, required: true })
  attributes: Map<string, string>;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  stock: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const VariantSchema = SchemaFactory.createForClass(Variant);
