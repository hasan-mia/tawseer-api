import { NotificationPriority, NotificationType } from '@/schemas/notification.schema';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class SendNotificationDto {
  @IsNotEmpty()
  readonly recipient: string;

  @IsOptional()
  readonly sender?: string;

  @IsNotEmpty()
  readonly title: string;

  @IsNotEmpty()
  readonly body: string;

  @IsNotEmpty()
  readonly type: NotificationType;

  @IsOptional()
  readonly priority?: NotificationPriority;

  @IsOptional()
  readonly data?: Record<string, any>;

  @IsOptional()
  readonly image?: string;

  @IsOptional()
  readonly icon?: string;

  @IsOptional()
  readonly sound?: string;

  @IsOptional()
  readonly actionUrl?: string;

  @IsOptional()
  readonly externalId?: string;

  @IsOptional()
  readonly scheduledFor?: Date;

  @IsOptional()
  readonly tags?: string[];

  @IsOptional()
  readonly sendPush?: boolean;
}

export class NotificationFilter {

  @IsOptional()
  readonly recipient?: string;

  @IsOptional()
  readonly type?: NotificationType;

  @IsOptional()
  readonly isRead?: boolean;

  @IsOptional()
  readonly isDeleted?: boolean;

  @IsOptional()
  readonly startDate?: Date;

  @IsOptional()
  readonly endDate?: Date;

  @IsOptional()
  readonly tags?: string[];

  @IsOptional()
  readonly page?: number;

  @IsOptional()
  readonly limit?: number;
}
