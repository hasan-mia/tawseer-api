import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';

// Define a type for day of the week
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Define a schema for opening hours per day
export class OpeningHoursPerDay {
    @Prop({ required: true })
    day: DayOfWeek;

    @Prop({ required: true })
    opens: string; // format: "HH:MM" (24-hour format)

    @Prop({ required: true })
    closes: string; // format: "HH:MM" (24-hour format)

    @Prop({ type: Boolean, default: true })
    isOpen: boolean;
}

// Define a schema for facilities
export class Facility {
    @Prop({ required: true })
    name: string;

    @Prop({ type: String })
    description: string;

    @Prop({ type: String })
    icon: string;
}

@Schema({
    timestamps: true,
})
export class Vendor extends Document {
    @Prop({ default: () => uuidv4() })
    uuid: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    user: Types.ObjectId;

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
        enum: ['salon', 'parlor', 'shop'],
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

    @Prop({ type: [Object], default: [] })
    openingHours: OpeningHoursPerDay[];

    @Prop({ type: [Object], default: [] })
    facilities: Facility[];

    @Prop({ type: Boolean, default: false })
    is_disabled: boolean;

    @Prop({ required: false, default: 0 })
    rating: number;

    @Prop({ required: false, default: 0 })
    queue: number;

    @Prop({ required: false, default: 0 })
    total_review: number;

    @Prop({ type: Boolean, default: false })
    is_deleted: boolean;

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

VendorSchema.index({ user: 1 });
VendorSchema.index({ location: '2dsphere' });