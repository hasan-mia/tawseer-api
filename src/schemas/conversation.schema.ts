import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
    timestamps: true,
})
export class Conversation extends Document {
    @Prop({ default: () => uuidv4() })
    uuid: string;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
    participants: Types.ObjectId[];

    @Prop({ default: false })
    is_group: boolean;

    @Prop()
    group_name?: string;

    @Prop({ type: Types.ObjectId, ref: 'Message' })
    last_message: Types.ObjectId;

    @Prop({ default: false })
    is_deleted: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Create index for faster lookups by participants
ConversationSchema.index({ participants: 1 });