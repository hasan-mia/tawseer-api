import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
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

    @Prop({
        required: true,
        unique: true,
        set: (name: string) => slugify(name, { lower: true, strict: true }),
    })
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

VendorSchema.pre<Vendor>('save', function (next) {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
    next();
});

VendorSchema.index({ slug: 1 }, { unique: true });

VendorSchema.index({ location: '2dsphere' });
