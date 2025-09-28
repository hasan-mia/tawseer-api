import admin from '@/firebase-admin.config';
import { Notification, NotificationPriority, NotificationType } from '@/schemas/notification.schema';
import { User } from '@/schemas/user.schema';
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationFilter, SendNotificationDto } from './dto/notification.dto';


@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    @InjectModel(User.name) private userModel: Model<User>,

  ) { }

  // Create and send notification
  async sendNotification(data: SendNotificationDto): Promise<any> {
    try {
      // Create notification in database
      const notification = await this.notificationModel.create({
        recipient: data.recipient,
        sender: data.sender,
        title: data.title,
        body: data.body,
        type: data.type,
        priority: data.priority || NotificationPriority.NORMAL,
        data: data.data || {},
        image: data.image,
        icon: data.icon,
        sound: data.sound,
        actionUrl: data.actionUrl,
        externalId: data.externalId,
        scheduledFor: data.scheduledFor,
        tags: data.tags || [],
        sentAt: new Date(),
      });

      // Send push notification if enabled
      if (data.sendPush !== false) {
        await this.sendPushNotification(notification._id.toString());
      }

      return {
        success: true,
        message: 'Notification sent successfully',
        data: notification,
      };
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      throw new InternalServerErrorException('Failed to send notification');
    }
  }

  // Send push notification via FCM
  async sendPushNotification(notificationId: string): Promise<boolean> {
    try {
      const notification = await this.notificationModel
        .findById(notificationId)
        .populate('recipient', 'fcmToken first_name');

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      const recipient = notification.recipient as any;
      if (!recipient.fcmToken) {
        this.logger.warn(`No FCM token for user ${recipient._id}`);
        return false;
      }

      const message: admin.messaging.Message = {
        token: recipient.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.image,
        },
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          actionUrl: notification.actionUrl || '',
          externalId: notification.externalId || '',
          ...notification.data,
        },
        android: {
          notification: {
            icon: notification.icon || 'ic_notification',
            sound: notification.sound || 'default',
            channelId: this.getChannelId(notification.type),
            priority: this.getAndroidPriority(notification.priority),
          },
          data: {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              badge: await this.getUnreadCount(recipient._id),
              category: notification.type,
            },
          },
        },
      };

      await admin.messaging().send(message);

      // Update notification as push sent
      await this.notificationModel.findByIdAndUpdate(notificationId, {
        isPushSent: true,
        deliveredAt: new Date(),
        isDelivered: true,
      });

      this.logger.log(`Push notification sent to user ${recipient._id}`);
      return true;
    } catch (error) {
      this.logger.error('Error sending push notification:', error);
      return false;
    }
  }

  // Get notifications with filters and pagination
  async getNotifications(filter: NotificationFilter): Promise<any> {
    try {
      const page = filter.page || 1;
      const limit = filter.limit || 20;
      const skip = (page - 1) * limit;

      let query: any = {
        isDeleted: false,
      };

      if (filter.recipient) query.recipient = filter.recipient;
      if (filter.type) query.type = filter.type;
      if (filter.isRead !== undefined) query.isRead = filter.isRead;
      if (filter.startDate || filter.endDate) {
        query.createdAt = {};
        if (filter.startDate) query.createdAt.$gte = filter.startDate;
        if (filter.endDate) query.createdAt.$lte = filter.endDate;
      }
      if (filter.tags && filter.tags.length > 0) {
        query.tags = { $in: filter.tags };
      }

      const [notifications, total] = await Promise.all([
        this.notificationModel
          .find(query)
          .populate('sender', 'first_name last_name avatar')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.notificationModel.countDocuments(query),
      ]);

      return {
        success: true,
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Error getting notifications:', error);
      throw new InternalServerErrorException('Failed to get notifications');
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId?: string): Promise<any> {
    try {
      const query: any = { _id: notificationId, isDeleted: false };
      if (userId) query.recipient = userId;

      const notification = await this.notificationModel.findOneAndUpdate(
        query,
        { isRead: true, readAt: new Date() },
        { new: true },
      );

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return {
        success: true,
        message: 'Notification marked as read',
        data: notification,
      };
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      throw new InternalServerErrorException('Failed to mark notification as read');
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<any> {
    try {
      const result = await this.notificationModel.updateMany(
        { recipient: userId, isRead: false, isDeleted: false },
        { isRead: true, readAt: new Date() },
      );

      return {
        success: true,
        message: `${result.modifiedCount} notifications marked as read`,
        count: result.modifiedCount,
      };
    } catch (error) {
      this.logger.error('Error marking all notifications as read:', error);
      throw new InternalServerErrorException('Failed to mark all notifications as read');
    }
  }

  // Delete notification
  async deleteNotification(notificationId: string, userId?: string): Promise<any> {
    try {
      const query: any = { _id: notificationId };
      if (userId) query.recipient = userId;

      const notification = await this.notificationModel.findOneAndUpdate(
        query,
        { isDeleted: true },
        { new: true },
      );

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting notification:', error);
      throw new InternalServerErrorException('Failed to delete notification');
    }
  }

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.notificationModel.countDocuments({
        recipient: userId,
        isRead: false,
        isDeleted: false,
      });
    } catch (error) {
      this.logger.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Send bulk notifications
  async sendBulkNotifications(
    recipients: string[],
    notificationData: Omit<SendNotificationDto, 'recipient'>,
  ): Promise<any> {
    try {
      const notifications = recipients.map(recipient => ({
        recipient,
        sender: notificationData.sender,
        title: notificationData.title,
        body: notificationData.body,
        type: notificationData.type,
        priority: notificationData.priority || NotificationPriority.NORMAL,
        data: notificationData.data || {},
        image: notificationData.image,
        icon: notificationData.icon,
        sound: notificationData.sound,
        actionUrl: notificationData.actionUrl,
        externalId: notificationData.externalId,
        scheduledFor: notificationData.scheduledFor,
        tags: notificationData.tags || [],
        sentAt: new Date(),
      }));

      const createdNotifications = await this.notificationModel.insertMany(notifications);

      // Send push notifications
      if (notificationData.sendPush !== false) {
        const pushPromises = createdNotifications.map(notification =>
          this.sendPushNotification(notification._id.toString()),
        );
        await Promise.allSettled(pushPromises);
      }

      return {
        success: true,
        message: `${createdNotifications.length} notifications sent successfully`,
        count: createdNotifications.length,
      };
    } catch (error) {
      this.logger.error('Error sending bulk notifications:', error);
      throw new InternalServerErrorException('Failed to send bulk notifications');
    }
  }

  // Helper methods
  private getChannelId(type: NotificationType): string {
    const channelMap = {
      [NotificationType.CHAT]: 'chat_messages',
      [NotificationType.BOOKING]: 'bookings',
      [NotificationType.ORDER]: 'orders',
      [NotificationType.PAYMENT]: 'payments',
      [NotificationType.SYSTEM]: 'system',
      [NotificationType.FRIEND_REQUEST]: 'social',
      [NotificationType.FOLLOW]: 'social',
      [NotificationType.VENDOR]: 'vendor',
      [NotificationType.PROMOTION]: 'promotions',
    };
    return channelMap[type] || 'default';
  }

  private getAndroidPriority(priority: NotificationPriority): 'min' | 'low' | 'default' | 'high' | 'max' {
    const priorityMap = {
      [NotificationPriority.LOW]: 'low' as const,
      [NotificationPriority.NORMAL]: 'default' as const,
      [NotificationPriority.HIGH]: 'high' as const,
      [NotificationPriority.URGENT]: 'max' as const,
    };
    return priorityMap[priority] || 'default';
  }

  // Predefined notification templates
  async sendChatNotification(senderId: string, recipientId: string, message: string): Promise<any> {
    const sender = await this.userModel.findById(senderId).select('first_name last_name avatar');

    return this.sendNotification({
      recipient: recipientId,
      sender: senderId,
      title: `${sender.first_name} ${sender.last_name}`,
      body: message,
      type: NotificationType.CHAT,
      priority: NotificationPriority.HIGH,
      data: {
        conversationId: senderId, // or actual conversation ID
        senderId,
        messagePreview: message.substring(0, 100),
      },
      actionUrl: `/chat/${senderId}`,
      externalId: senderId,
      tags: ['chat', 'message'],
    });
  }

  async sendBookingNotification(userId: string, bookingId: string, status: string, details?: any): Promise<any> {
    const statusMessages = {
      confirmed: 'Your booking has been confirmed!',
      cancelled: 'Your booking has been cancelled.',
      completed: 'Your booking has been completed.',
      pending: 'Your booking is pending confirmation.',
    };

    return this.sendNotification({
      recipient: userId,
      title: 'Booking Update',
      body: statusMessages[status] || `Booking status: ${status}`,
      type: NotificationType.BOOKING,
      priority: NotificationPriority.HIGH,
      data: {
        bookingId,
        status,
        ...details,
      },
      actionUrl: `/bookings/${bookingId}`,
      externalId: bookingId,
      tags: ['booking', status],
    });
  }

  async sendOrderNotification(userId: string, orderId: string, status: string, details?: any): Promise<any> {
    const statusMessages = {
      placed: 'Your order has been placed successfully!',
      confirmed: 'Your order has been confirmed.',
      processing: 'Your order is being processed.',
      shipped: 'Your order has been shipped.',
      delivered: 'Your order has been delivered.',
      cancelled: 'Your order has been cancelled.',
    };

    return this.sendNotification({
      recipient: userId,
      title: 'Order Update',
      body: statusMessages[status] || `Order status: ${status}`,
      type: NotificationType.ORDER,
      priority: NotificationPriority.HIGH,
      data: {
        orderId,
        status,
        ...details,
      },
      actionUrl: `/orders/${orderId}`,
      externalId: orderId,
      tags: ['order', status],
    });
  }
}