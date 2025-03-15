import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: "Category" }] })
  categories: Types.ObjectId[];

  @Prop({ type: Map, of: String })
  attributes: Map<string, string>;

  @Prop({ type: [{ type: Types.ObjectId, ref: "Review" }] })
  reviews: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false })
  vendor: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
