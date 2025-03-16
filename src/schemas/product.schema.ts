import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model, Types } from "mongoose";
import slugify from "slugify";

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true })
  slug: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false })
  vendor: Types.ObjectId;

  @Prop({
    enum: ['draft', 'pending', 'approved', 'rejected'],
    required: true,
  })
  status: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.pre<Product>('save', async function (next) {
  if (this.isModified('name') || this.isNew) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;

    const existModel: Model<Product> = this.constructor as Model<Product>;

    let slugExists = await existModel.findOne({ slug });

    let count = 1;
    while (slugExists) {
      slug = `${baseSlug}-${count}`;
      count++;
      slugExists = await existModel.findOne({ slug });
    }

    this.slug = slug;
  }

  next();
});


ProductSchema.index({ slug: 1 }, { unique: true });
