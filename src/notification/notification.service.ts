import { Notification, NotificationPriority, NotificationType } from '@/schemas/notification.schema';
import { User } from '@/schemas/user.schema';
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Model } from 'mongoose';
import { NotificationFilter, SendNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private expo: Expo;

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true,
    });
  }

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

  // Send push notification via Expo
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
        this.logger.warn(`No Expo push token for user ${recipient._id}`);
        return false;
      }

      // Validate the Expo push token
      if (!Expo.isExpoPushToken(recipient.fcmToken)) {
        this.logger.error(`Invalid Expo push token for user ${recipient._id}: ${recipient.fcmToken}`);
        return false;
      }

      const message: ExpoPushMessage = {
        to: recipient.fcmToken,
        sound: notification.sound || 'default',
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          actionUrl: notification.actionUrl || '',
          externalId: notification.externalId || '',
          ...notification.data,
        },
        badge: await this.getUnreadCount(recipient._id),
        priority: this.getExpoPriority(notification.priority),
        channelId: this.getChannelId(notification.type),
      };

      // Add image if provided
      if (notification.image) {
        // Expo supports images via the 'image' field (Android) or through rich notifications
        (message as any).image = notification.image;
      }

      // Send the notification
      const ticketChunk = await this.expo.sendPushNotificationsAsync([message]);

      // Check if notification was sent successfully
      const ticket = ticketChunk[0];
      const success = ticket.status === 'ok';

      if (!success && ticket.status === 'error') {
        this.logger.error(`Error sending push notification: ${ticket.message}`);

        // Handle invalid tokens
        if (ticket.details?.error === 'DeviceNotRegistered') {
          this.logger.warn(`Removing invalid Expo token for user ${recipient._id}`);
          await this.userModel.findByIdAndUpdate(recipient._id, {
            $unset: { fcmToken: 1 }
          });
        }
      }

      // Update notification as push sent
      await this.notificationModel.findByIdAndUpdate(notificationId, {
        isPushSent: success,
        deliveredAt: success ? new Date() : null,
        isDelivered: success,
      });

      if (success) {
        this.logger.log(`Push notification sent to user ${recipient._id}`);
      }

      return success;
    } catch (error) {
      this.logger.error('Error sending push notification:', error);
      return false;
    }
  }

  // Send Directly push notification via Expo without saving
  async sendDirectPushNotification(notification: any): Promise<boolean> {
    try {
      const recipient = await this.userModel
        .findById(notification.recipient)
        .select('fcmToken first_name last_name avatar');

      if (!recipient) {
        throw new NotFoundException('Participant not found');
      }

      if (!recipient.fcmToken) {
        this.logger.warn(`No Expo push token for user ${recipient._id}`);
        return false;
      }

      // Validate the Expo push token
      if (!Expo.isExpoPushToken(recipient.fcmToken)) {
        this.logger.error(`Invalid Expo push token for user ${recipient._id}: ${recipient.fcmToken}`);
        return false;
      }

      const message: ExpoPushMessage = {
        to: recipient.fcmToken,
        sound: notification.sound || 'default',
        title: notification.title,
        body: notification.body,
        data: {
          type: notification.type,
          actionUrl: notification.actionUrl || '',
          externalId: notification.externalId || '',
          ...notification.data,
        },
        badge: await this.getUnreadCount(notification.recipient),
        priority: this.getExpoPriority(notification.priority),
        channelId: this.getChannelId(notification.type),
      };

      // Add image if provided
      if (notification.image) {
        (message as any).image = notification.image;
      }

      // Send the notification
      const ticketChunk = await this.expo.sendPushNotificationsAsync([message]);

      // Check if notification was sent successfully
      const ticket = ticketChunk[0];
      const success = ticket.status === 'ok';

      if (!success && ticket.status === 'error') {
        this.logger.error(`Error sending direct push notification: ${ticket.message}`);

        // Handle invalid tokens
        if (ticket.details?.error === 'DeviceNotRegistered') {
          this.logger.warn(`Removing invalid Expo token for user ${recipient._id}`);
          await this.userModel.findByIdAndUpdate(recipient._id, {
            $unset: { fcmToken: 1 }
          });
        }
      }

      if (success) {
        this.logger.log(`Direct push notification sent to user ${recipient._id}`);
      }

      return success;
    } catch (error) {
      this.logger.error('Error sending direct push notification:', error);
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
        await this.sendBulkPushNotifications(
          createdNotifications.map(n => n._id.toString())
        );
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

  // Send bulk push notifications efficiently
  private async sendBulkPushNotifications(notificationIds: string[]): Promise<void> {
    try {
      // Fetch all notifications with recipients
      const notifications = await this.notificationModel
        .find({ _id: { $in: notificationIds } })
        .populate('recipient', 'fcmToken _id')
        .lean();

      // Prepare messages
      const messages: ExpoPushMessage[] = [];
      const validNotifications: any[] = [];

      for (const notification of notifications) {
        const recipient = notification.recipient as any;

        if (!recipient?.fcmToken) {
          this.logger.warn(`No Expo push token for user ${recipient?._id}`);
          continue;
        }

        if (!Expo.isExpoPushToken(recipient.fcmToken)) {
          this.logger.error(`Invalid Expo push token for user ${recipient._id}`);
          continue;
        }

        messages.push({
          to: recipient.fcmToken,
          sound: notification.sound || 'default',
          title: notification.title,
          body: notification.body,
          data: {
            notificationId: notification._id.toString(),
            type: notification.type,
            actionUrl: notification.actionUrl || '',
            externalId: notification.externalId || '',
            ...notification.data,
          },
          priority: this.getExpoPriority(notification.priority),
          channelId: this.getChannelId(notification.type),
        });

        validNotifications.push(notification);
      }

      if (messages.length === 0) {
        this.logger.warn('No valid push tokens found for bulk notifications');
        return;
      }

      // Send notifications in chunks (Expo recommends max 100 per request)
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error('Error sending push notification chunk:', error);
        }
      }

      // Update notification statuses based on tickets
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const notification = validNotifications[i];

        if (ticket.status === 'ok') {
          await this.notificationModel.findByIdAndUpdate(notification._id, {
            isPushSent: true,
            deliveredAt: new Date(),
            isDelivered: true,
          });
        } else if (ticket.status === 'error') {
          this.logger.error(`Error for notification ${notification._id}: ${ticket.message}`);
        }
      }

      this.logger.log(`Bulk push notifications sent: ${tickets.filter(t => t.status === 'ok').length}/${tickets.length}`);
    } catch (error) {
      this.logger.error('Error in bulk push notifications:', error);
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

  private getExpoPriority(priority: NotificationPriority): 'default' | 'normal' | 'high' {
    const priorityMap = {
      [NotificationPriority.LOW]: 'default' as const,
      [NotificationPriority.NORMAL]: 'normal' as const,
      [NotificationPriority.HIGH]: 'high' as const,
      [NotificationPriority.URGENT]: 'high' as const,
    };
    return priorityMap[priority] || 'normal';
  }

  // Predefined notification templates
  async sendChatNotification(
    senderId: string,
    recipientId: string,
    conversationId: string,
    message: string,
  ): Promise<any> {
    const sender = await this.userModel
      .findById(senderId)
      .select('first_name last_name avatar');

    return this.sendDirectPushNotification({
      recipient: recipientId,
      sender: senderId,
      title: `${sender.first_name} ${sender.last_name}`,
      body: message,
      type: NotificationType.CHAT,
      priority: NotificationPriority.HIGH,
      data: {
        conversationId: conversationId,
        senderId,
        messagePreview: message.substring(0, 100),
      },
      actionUrl: `/message/${conversationId}`,
      externalId: senderId,
      tags: ['chat', 'message'],
    });
  }

  async sendBookingNotification(
    userId: string,
    bookingId: string,
    status: string,
    details?: any,
  ): Promise<any> {
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

  async sendOrderNotification(
    userId: string,
    orderId: string,
    status: string,
    details?: any,
  ): Promise<any> {
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