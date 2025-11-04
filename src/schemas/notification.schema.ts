import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum NotificationType {
    BOOKING = 'booking',
    ORDER = 'order',
    CHAT = 'chat',
    PAYMENT = 'payment',
    SYSTEM = 'system',
    FRIEND_REQUEST = 'friend_request',
    FOLLOW = 'follow',
    VENDOR = 'vendor',
    PROMOTION = 'promotion',
}

export enum NotificationPriority {
    LOW = 'low',
    NORMAL = 'normal',
    HIGH = 'high',
    URGENT = 'urgent',
}

@Schema({
    timestamps: true,
})
export class Notification extends Document {
    @Prop({ default: () => uuidv4() })
    uuid: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    recipient: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    sender: string;

    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    body: string;

    @Prop({
        type: String,
        enum: Object.values(NotificationType),
        required: true,
        default: NotificationType.SYSTEM,
    })
    type: NotificationType;

    @Prop({
        type: String,
        enum: Object.values(NotificationPriority),
        default: NotificationPriority.NORMAL,
    })
    priority: NotificationPriority;

    @Prop({ type: Object, default: {} })
    data: Record<string, any>;

    @Prop({ type: String })
    image: string;

    @Prop({ type: String })
    icon: string;

    @Prop({ type: String })
    sound: string;

    @Prop({ type: String })
    category: string;

    @Prop({ type: String })
    actionUrl: string;

    @Prop({ type: String })
    externalId: string;

    @Prop({ default: false })
    isRead: boolean;

    @Prop({ default: false })
    isDelivered: boolean;

    @Prop({ default: false })
    isPushSent: boolean;

    @Prop({ type: Date })
    readAt: Date;

    @Prop({ type: Date })
    deliveredAt: Date;

    @Prop({ type: Date })
    sentAt: Date;

    @Prop({ type: Date })
    scheduledFor: Date;

    @Prop({ type: Array, default: [] })
    tags: string[];

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop({ type: Date })
    expiresAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ externalId: 1, type: 1 });
NotificationSchema.index({ sentAt: 1 });