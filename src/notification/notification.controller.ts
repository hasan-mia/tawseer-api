import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationFilter, SendNotificationDto } from './dto/notification.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  // Get user's notifications
  @Get()
  async getNotifications(@Request() req, @Query() query: any) {
    const filter: NotificationFilter = {
      recipient: req.user.id,
      type: query.type,
      isRead: query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      tags: query.tags ? query.tags.split(',') : undefined,
    };

    return this.notificationService.getNotifications(filter);
  }

  // Get unread notification count
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return {
      success: true,
      data: { count },
    };
  }

  // Mark notification as read
  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  // Mark all notifications as read
  @Put('mark-all-read')
  async markAllAsRead(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  // Delete notification
  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req) {
    return this.notificationService.deleteNotification(id, req.user.id);
  }

  // Send notification (admin only)
  @Post('send')
  async sendNotification(@Body() data: SendNotificationDto) {
    return this.notificationService.sendNotification(data);
  }

  // Send bulk notifications (admin only)
  @Post('send-bulk')
  async sendBulkNotifications(
    @Body() data: { recipients: string[]; notification: Omit<SendNotificationDto, 'recipient'> }
  ) {
    return this.notificationService.sendBulkNotifications(data.recipients, data.notification);
  }
}