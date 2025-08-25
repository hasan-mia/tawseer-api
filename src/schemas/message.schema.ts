import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({
    timestamps: true,
})
export class Message extends Document {
    @Prop({ default: () => uuidv4() })
    uuid: string;

    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversation: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    sender: Types.ObjectId;

    @Prop({ required: true })
    content: string;

    @Prop({ default: false })
    is_read: boolean;

    @Prop()
    read_at: Date;

    @Prop({ type: [String], default: [] })
    attachments: string[];

    @Prop({ type: Types.ObjectId, ref: 'Message' })
    parent_message: Types.ObjectId;

    @Prop({ type: Boolean, default: false })
    is_deleted: boolean;
}


export const MessageSchema = SchemaFactory.createForClass(Message);