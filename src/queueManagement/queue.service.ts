import { NotificationService } from '@/notification/notification.service'; // Import NotificationService
import { Appointment } from '@/schemas/appointment.schema';
import { Notification, NotificationPriority, NotificationType } from '@/schemas/notification.schema';
import { User } from '@/schemas/user.schema';
import { Vendor } from '@/schemas/vendor.schema';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';

export interface QueueItem {
    appointmentId: string;
    userId: string;
    vendorId: string;
    appointmentTime: Date;
    isPaid: boolean;
    position: number;
    estimatedWaitTime: number;
}

@Injectable()
export class QueueManagementService {
    private readonly logger = new Logger(QueueManagementService.name);
    private queueCache: Map<string, QueueItem[]> = new Map();

    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
        @InjectModel(Notification.name) private notificationModel: Model<Notification>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
        private readonly notificationService: NotificationService, // *** ADD THIS ***
    ) {
        this.initializeQueues();
    }

    /**
     * Initialize queues for all vendors on service startup
     */
    private async initializeQueues() {
        this.logger.log('Initializing vendor queues...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const appointments = await this.appointmentModel
            .find({
                appointment_time: { $gte: today },
                status: { $in: ['pending', 'confirm'] },
            })
            .populate('user vendor')
            .sort({ appointment_time: 1 });

        const vendorQueues = new Map<string, Appointment[]>();

        appointments.forEach((appointment) => {
            const vendorId = (appointment.vendor as any)._id.toString();
            if (!vendorQueues.has(vendorId)) {
                vendorQueues.set(vendorId, []);
            }
            vendorQueues.get(vendorId).push(appointment);
        });

        vendorQueues.forEach((appointments, vendorId) => {
            this.buildVendorQueue(vendorId, appointments);
        });

        this.logger.log(`Initialized queues for ${vendorQueues.size} vendors`);
    }

    /**
     * Build queue for a specific vendor with payment priority
     */
    private buildVendorQueue(vendorId: string, appointments: Appointment[]) {
        const sortedAppointments = appointments.sort((a, b) => {
            const aPaid = a.payment_status === 'success';
            const bPaid = b.payment_status === 'success';

            if (aPaid !== bPaid) {
                return aPaid ? -1 : 1;
            }

            return a.appointment_time.getTime() - b.appointment_time.getTime();
        });

        const queueItems: QueueItem[] = sortedAppointments.map((apt, index) => {
            const estimatedWaitTime = this.calculateWaitTime(index, sortedAppointments);

            return {
                appointmentId: apt._id.toString(),
                userId: (apt.user as any)._id.toString(),
                vendorId: vendorId,
                appointmentTime: apt.appointment_time,
                isPaid: apt.payment_status === 'success',
                position: index + 1,
                estimatedWaitTime,
            };
        });

        this.queueCache.set(vendorId, queueItems);
    }

    /**
     * Calculate estimated wait time based on position
     */
    private calculateWaitTime(position: number, appointments: Appointment[]): number {
        const avgServiceTime = 30;
        let totalWaitTime = 0;

        for (let i = 0; i < position; i++) {
            totalWaitTime += avgServiceTime;
        }

        return totalWaitTime;
    }

    /**
     * Get queue position for a user
     */
    async getQueuePosition(userId: string, vendorId: string): Promise<QueueItem | null> {
        const queue = this.queueCache.get(vendorId);
        if (!queue) return null;

        return queue.find(item => item.userId === userId) || null;
    }

    /**
     * Join vendor queue (when booking is created)
     */
    async joinQueue(appointmentId: string): Promise<QueueItem> {
        const appointment = await this.appointmentModel
            .findById(appointmentId)
            .populate('user vendor service');

        if (!appointment) {
            throw new Error('Appointment not found');
        }

        const vendorId = (appointment.vendor as any)._id.toString();

        await this.refreshVendorQueue(vendorId);

        const position = await this.getQueuePosition(
            (appointment.user as any)._id.toString(),
            vendorId
        );

        if (position) {
            // *** SEND PUSH NOTIFICATION ***
            await this.notifyQueuePosition(position, appointment);
        }

        return position;
    }

    /**
     * Leave vendor queue (when appointment is cancelled)
     */
    async leaveQueue(appointmentId: string): Promise<void> {
        const appointment = await this.appointmentModel
            .findById(appointmentId)
            .populate('vendor');

        if (!appointment) return;

        const vendorId = (appointment.vendor as any)._id.toString();
        await this.refreshVendorQueue(vendorId);
    }

    /**
     * Update queue when payment status changes
     */
    async updateQueueOnPayment(appointmentId: string): Promise<void> {
        const appointment = await this.appointmentModel
            .findById(appointmentId)
            .populate('vendor user service');

        if (!appointment) return;

        const vendorId = (appointment.vendor as any)._id.toString();
        const oldPosition = await this.getQueuePosition(
            (appointment.user as any)._id.toString(),
            vendorId
        );

        await this.refreshVendorQueue(vendorId);

        const newPosition = await this.getQueuePosition(
            (appointment.user as any)._id.toString(),
            vendorId
        );

        if (newPosition) {
            // *** SEND PUSH NOTIFICATION WITH UPDATED POSITION ***
            await this.notificationService.sendNotification({
                recipient: (appointment.user as any)._id.toString(),
                title: '🎉 Payment Confirmed!',
                body: `Your payment is confirmed! You've moved to position #${newPosition.position} in line at ${(appointment.vendor as any).name}.`,
                type: NotificationType.VENDOR,
                priority: NotificationPriority.HIGH,
                data: {
                    appointmentId,
                    vendorId,
                    serviceName: (appointment.service as any)?.name,
                    oldPosition: oldPosition?.position,
                    newPosition: newPosition.position,
                    estimatedWaitTime: newPosition.estimatedWaitTime,
                    isPaid: true,
                },
                actionUrl: `/appointments/${appointmentId}`,
                externalId: appointmentId,
                tags: ['queue', 'payment', 'priority'],
                sound: 'success',
                icon: '💳',
            });

            this.logger.log(`Payment confirmed notification sent for appointment ${appointmentId}`);
        }
    }

    /**
     * Refresh queue for a specific vendor
     */
    private async refreshVendorQueue(vendorId: string): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const appointments = await this.appointmentModel
            .find({
                vendor: new Types.ObjectId(vendorId),
                appointment_time: { $gte: today },
                status: { $in: ['pending', 'confirm'] },
            })
            .populate('user vendor');

        this.buildVendorQueue(vendorId, appointments);
    }

    /**
     * Send 15-minute reminder notifications (runs every minute)
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async sendAppointmentReminders() {
        const now = new Date();
        const reminderTime = new Date(now.getTime() + 15 * 60 * 1000);

        const upcomingAppointments = await this.appointmentModel
            .find({
                appointment_time: {
                    $gte: now,
                    $lte: reminderTime,
                },
                status: { $in: ['pending', 'confirm'] },
            })
            .populate('user vendor service');

        for (const appointment of upcomingAppointments) {
            const existingNotification = await this.notificationModel.findOne({
                recipient: (appointment.user as any)._id,
                externalId: appointment._id.toString(),
                type: NotificationType.VENDOR,
                title: 'Appointment Reminder',
                sentAt: { $exists: true },
            });

            if (!existingNotification) {
                // *** SEND PUSH NOTIFICATION VIA NotificationService ***
                await this.notificationService.sendNotification({
                    recipient: (appointment.user as any)._id.toString(),
                    title: '⏰ Appointment Reminder',
                    body: `Your appointment at ${(appointment.vendor as any).name} is in 15 minutes! Please arrive on time.`,
                    type: NotificationType.VENDOR,
                    priority: NotificationPriority.URGENT,
                    data: {
                        appointmentId: appointment._id.toString(),
                        vendorId: (appointment.vendor as any)._id.toString(),
                        vendorName: (appointment.vendor as any).name,
                        serviceName: (appointment.service as any)?.name,
                        appointmentTime: appointment.appointment_time,
                        address: (appointment.vendor as any)?.address,
                    },
                    actionUrl: `/appointments/${appointment._id}`,
                    externalId: appointment._id.toString(),
                    tags: ['appointment', 'reminder', 'urgent'],
                    sound: 'alarm',
                    icon: '⏰',
                });

                this.logger.log(`Sent 15-min reminder for appointment ${appointment._id}`);
            }
        }
    }

    /**
     * Vendor sends manual notification to customer
     */
    async sendVendorNotification(
        vendorId: string,
        userId: string,
        message: string,
        appointmentId?: string,
    ): Promise<void> {
        const vendor = await this.vendorModel.findById(vendorId);

        // *** SEND PUSH NOTIFICATION VIA NotificationService ***
        await this.notificationService.sendNotification({
            recipient: userId,
            sender: vendorId,
            title: `📢 Message from ${vendor.name}`,
            body: message,
            type: NotificationType.VENDOR,
            priority: NotificationPriority.HIGH,
            data: {
                vendorId,
                vendorName: vendor.name,
                appointmentId,
                customMessage: true,
            },
            actionUrl: appointmentId ? `/appointments/${appointmentId}` : `/vendors/${vendorId}`,
            externalId: appointmentId,
            tags: ['vendor', 'message', 'manual'],
            sound: 'default',
            icon: '💬',
        });

        this.logger.log(`Vendor notification sent from ${vendorId} to user ${userId}`);
    }

    /**
     * Send notification about queue position
     */
    private async notifyQueuePosition(position: QueueItem, appointment?: any): Promise<void> {
        const vendor = appointment?.vendor as any;
        const service = appointment?.service as any;

        let body = '';
        let icon = '';

        if (position.position === 1) {
            body = `You're next in line at ${vendor?.name || 'the salon'}! Please be ready.`;
            icon = '🎯';
        } else if (position.isPaid) {
            body = `You're at position #${position.position} (Priority Queue) at ${vendor?.name || 'the salon'}. Estimated wait: ${position.estimatedWaitTime} minutes.`;
            icon = '⭐';
        } else {
            body = `You're at position #${position.position} at ${vendor?.name || 'the salon'}. Estimated wait: ${position.estimatedWaitTime} minutes. Pay now for priority!`;
            icon = '📍';
        }

        // *** SEND PUSH NOTIFICATION VIA NotificationService ***
        await this.notificationService.sendNotification({
            recipient: position.userId,
            title: '📊 Queue Position',
            body,
            type: NotificationType.VENDOR,
            priority: position.position === 1 ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
            data: {
                appointmentId: position.appointmentId,
                vendorId: position.vendorId,
                vendorName: vendor?.name,
                serviceName: service?.name,
                position: position.position,
                estimatedWaitTime: position.estimatedWaitTime,
                isPaid: position.isPaid,
                isNext: position.position === 1,
            },
            actionUrl: `/appointments/${position.appointmentId}`,
            externalId: position.appointmentId,
            tags: ['queue', 'position', position.isPaid ? 'paid' : 'unpaid'],
            sound: position.position === 1 ? 'alert' : 'default',
            icon,
        });

        this.logger.log(`Queue position notification sent to user ${position.userId}: #${position.position}`);
    }

    /**
     * Notify customers when they move up in queue
     */
    async notifyQueueMovement(vendorId: string): Promise<void> {
        const queue = this.queueCache.get(vendorId);
        if (!queue || queue.length === 0) return;

        // Notify the first customer they're next
        if (queue[0]) {
            const appointment = await this.appointmentModel
                .findById(queue[0].appointmentId)
                .populate('vendor service');

            if (appointment) {
                await this.notificationService.sendNotification({
                    recipient: queue[0].userId,
                    title: "🎯 You're Next!",
                    body: `You're next in line at ${(appointment.vendor as any).name}. Please be ready!`,
                    type: NotificationType.VENDOR,
                    priority: NotificationPriority.URGENT,
                    data: {
                        appointmentId: queue[0].appointmentId,
                        vendorId,
                        position: 1,
                        isNext: true,
                    },
                    actionUrl: `/appointments/${queue[0].appointmentId}`,
                    externalId: queue[0].appointmentId,
                    tags: ['queue', 'next', 'urgent'],
                    sound: 'alert',
                    icon: '🎯',
                });
            }
        }

        // Notify second customer they're up soon
        if (queue[1]) {
            await this.notificationService.sendNotification({
                recipient: queue[1].userId,
                title: '⏳ Almost Your Turn',
                body: `You're #2 in line. Your turn is coming up soon!`,
                type: NotificationType.VENDOR,
                priority: NotificationPriority.HIGH,
                data: {
                    appointmentId: queue[1].appointmentId,
                    vendorId,
                    position: 2,
                },
                actionUrl: `/appointments/${queue[1].appointmentId}`,
                tags: ['queue', 'upcoming'],
            });
        }
    }

    /**
     * Get all customers in queue for a vendor
     */
    async getVendorQueue(vendorId: string): Promise<QueueItem[]> {
        await this.refreshVendorQueue(vendorId);
        return this.queueCache.get(vendorId) || [];
    }
}