import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import slugify from 'slugify';

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true })
  slug: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  parentCategory: Types.ObjectId;

  @Prop({ type: String, required: false })
  image: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.pre<Category>('save', async function (next) {
  if (this.isModified('name') || this.isNew) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;

    const existModel: Model<Category> = this.constructor as Model<Category>;

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