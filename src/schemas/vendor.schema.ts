import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';

@Schema({
    timestamps: true,
})
export class Vendor extends Document {
    @Prop({ default: () => uuidv4() })
    uuid: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    vendor: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop({ type: String, unique: true })
    slug: string;

    @Prop({ required: true })
    bio: string;

    @Prop({ required: true })
    logo: string;

    @Prop({ required: true })
    cover: string;

    @Prop({
        enum: ['salon', 'parlor', 'product'],
        required: true,
    })
    type: string;

    @Prop({ required: true })
    address: string;

    @Prop({ required: true })
    mobile: string;

    @Prop()
    tin_certificate: string;

    @Prop({ type: Boolean, default: false })
    is_verified: boolean;

    @Prop({
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
    })
    location: {
        type: string;
        coordinates: number[];
    };

    @Prop({ type: Boolean, default: false })
    is_deleted: boolean;

    @Prop({ type: Boolean, default: false })
    is_disabled: boolean;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);

VendorSchema.pre<Vendor>('save', async function (next) {
    if (this.isModified('name') || this.isNew) {
        let baseSlug = slugify(this.name, { lower: true, strict: true });
        let slug = baseSlug;

        const existModel: Model<Vendor> = this.constructor as Model<Vendor>;

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

VendorSchema.index({ location: '2dsphere' });
