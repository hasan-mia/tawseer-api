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
        // Sort appointments: paid first, then by appointment time
        const sortedAppointments = appointments.sort((a, b) => {
            const aPaid = a.payment_status === 'success';
            const bPaid = b.payment_status === 'success';

            // If payment status differs, paid comes first
            if (aPaid !== bPaid) {
                return aPaid ? -1 : 1;
            }

            // If same payment status, sort by appointment time
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
        // Average service duration (from Service schema) or default 30 minutes
        const avgServiceTime = 30; // minutes
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

        // Refresh queue for this vendor
        await this.refreshVendorQueue(vendorId);

        const position = await this.getQueuePosition(
            (appointment.user as any)._id.toString(),
            vendorId
        );

        if (position) {
            // Send notification to user about their position
            await this.notifyQueuePosition(position);
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
            .populate('vendor user');

        if (!appointment) return;

        const vendorId = (appointment.vendor as any)._id.toString();
        await this.refreshVendorQueue(vendorId);

        // Notify user of their new position
        const position = await this.getQueuePosition(
            (appointment.user as any)._id.toString(),
            vendorId
        );

        if (position) {
            await this.createNotification({
                recipient: (appointment.user as any)._id.toString(),
                title: 'Queue Position Updated',
                body: `Your payment is confirmed! You are now #${position.position} in line.`,
                type: NotificationType.VENDOR,
                priority: NotificationPriority.HIGH,
                data: {
                    appointmentId,
                    vendorId,
                    position: position.position,
                    estimatedWaitTime: position.estimatedWaitTime,
                },
            });
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
        const reminderTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

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
            // Check if reminder was already sent
            const existingNotification = await this.notificationModel.findOne({
                recipient: (appointment.user as any)._id,
                externalId: appointment._id.toString(),
                type: NotificationType.VENDOR,
                title: 'Appointment Reminder',
                sentAt: { $exists: true },
            });

            if (!existingNotification) {
                await this.createNotification({
                    recipient: (appointment.user as any)._id.toString(),
                    title: 'Appointment Reminder',
                    body: `Your appointment is in 15 minutes at ${(appointment.vendor as any).name}`,
                    type: NotificationType.VENDOR,
                    priority: NotificationPriority.URGENT,
                    externalId: appointment._id.toString(),
                    data: {
                        appointmentId: appointment._id.toString(),
                        vendorId: (appointment.vendor as any)._id.toString(),
                        serviceName: (appointment.service as any).name,
                        appointmentTime: appointment.appointment_time,
                    },
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

        await this.createNotification({
            recipient: userId,
            sender: vendorId,
            title: `Message from ${vendor.name}`,
            body: message,
            type: NotificationType.VENDOR,
            priority: NotificationPriority.HIGH,
            externalId: appointmentId,
            data: {
                vendorId,
                appointmentId,
                customMessage: true,
            },
        });
    }

    /**
     * Send notification about queue position
     */
    private async notifyQueuePosition(position: QueueItem): Promise<void> {
        await this.createNotification({
            recipient: position.userId,
            title: 'Queue Position',
            body: `You are #${position.position} in line. Estimated wait: ${position.estimatedWaitTime} minutes`,
            type: NotificationType.VENDOR,
            priority: NotificationPriority.NORMAL,
            data: {
                appointmentId: position.appointmentId,
                vendorId: position.vendorId,
                position: position.position,
                estimatedWaitTime: position.estimatedWaitTime,
                isPaid: position.isPaid,
            },
        });
    }

    /**
     * Create notification helper
     */
    private async createNotification(data: any): Promise<Notification> {
        const notification = new this.notificationModel({
            ...data,
            sentAt: new Date(),
            isDelivered: false,
            isRead: false,
            isPushSent: false,
        });

        return await notification.save();
    }

    /**
     * Get all customers in queue for a vendor
     */
    async getVendorQueue(vendorId: string): Promise<QueueItem[]> {
        await this.refreshVendorQueue(vendorId);
        return this.queueCache.get(vendorId) || [];
    }
}