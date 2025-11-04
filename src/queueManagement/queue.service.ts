import { NotificationService } from '@/notification/notification.service';
import { Appointment } from '@/schemas/appointment.schema';
import { Notification, NotificationPriority, NotificationType } from '@/schemas/notification.schema';
import { User } from '@/schemas/user.schema';
import { Vendor } from '@/schemas/vendor.schema';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

/**
 * HYBRID STRATEGY:
 * - Cache: Fast reads for real-time queue positions
 * - Database: Source of truth (appointments already stored)
 * - Auto-recovery: Rebuild cache from DB on startup
 * 
 * NO DATA LOSS because:
 * 1. Appointments are ALWAYS in database
 * 2. Cache is rebuilt from DB on server restart
 * 3. Queue state is computed from appointment data
 */
@Injectable()
export class QueueManagementService implements OnModuleInit {
    private readonly logger = new Logger(QueueManagementService.name);

    // In-memory cache for FAST reads
    private queueCache: Map<string, QueueItem[]> = new Map();

    // Cache metadata
    private cacheMetadata: Map<string, { lastRefresh: Date; itemCount: number }> = new Map();

    // Cache TTL (5 minutes)
    private readonly CACHE_TTL_MS = 5 * 60 * 1000;

    constructor(
        @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
        @InjectModel(Notification.name) private notificationModel: Model<Notification>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * 🔄 AUTO-RECOVERY: Initialize cache from database on startup
     * This prevents data loss on server restart
     */
    async onModuleInit() {
        await this.initializeQueuesFromDatabase();
    }

    /**
     * 📦 Rebuild ALL vendor queues from database
     * Called on:
     * - Server startup (onModuleInit)
     * - Manual trigger (admin endpoint)
     */
    async initializeQueuesFromDatabase() {
        this.logger.log('🔄 Rebuilding queues from database...');
        const startTime = Date.now();

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all active appointments from DB (source of truth)
            const appointments = await this.appointmentModel
                .find({
                    appointment_time: { $gte: today },
                    status: { $in: ['pending', 'confirm'] },
                })
                .populate('user vendor service')
                .sort({ appointment_time: 1 })
                .lean();

            // Group by vendor
            const vendorQueues = new Map<string, any[]>();
            appointments.forEach((apt) => {
                const vendorId = (apt.vendor as any)._id.toString();
                if (!vendorQueues.has(vendorId)) {
                    vendorQueues.set(vendorId, []);
                }
                vendorQueues.get(vendorId).push(apt);
            });

            // Build cache for each vendor
            let totalItems = 0;
            vendorQueues.forEach((appointments, vendorId) => {
                this.buildVendorQueue(vendorId, appointments);
                totalItems += appointments.length;
            });

            const duration = Date.now() - startTime;
            this.logger.log(
                `✅ Rebuilt ${vendorQueues.size} vendor queues with ${totalItems} appointments in ${duration}ms`
            );

            return {
                success: true,
                vendorCount: vendorQueues.size,
                appointmentCount: totalItems,
                durationMs: duration,
            };
        } catch (error) {
            this.logger.error('❌ Failed to rebuild queues from database:', error);
            throw error;
        }
    }

    /**
     * 🏗️ Build queue for a specific vendor with payment priority
     */
    private buildVendorQueue(vendorId: string, appointments: any[]) {
        // Sort: Paid customers first, then by appointment time
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

        // Update cache
        this.queueCache.set(vendorId, queueItems);

        // Update metadata
        this.cacheMetadata.set(vendorId, {
            lastRefresh: new Date(),
            itemCount: queueItems.length,
        });

        this.logger.debug(`📊 Built queue for vendor ${vendorId}: ${queueItems.length} items`);
    }

    /**
     * ⏱️ Calculate wait time
     */
    private calculateWaitTime(position: number, appointments: any[]): number {
        let totalWaitTime = 0;
        for (let i = 0; i < position; i++) {
            const serviceDuration = (appointments[i].service as any)?.duration || 30;
            totalWaitTime += serviceDuration;
        }
        return totalWaitTime;
    }

    /**
     * 🔍 Check if cache needs refresh
     */
    private isCacheStale(vendorId: string): boolean {
        const metadata = this.cacheMetadata.get(vendorId);
        if (!metadata) return true;

        const age = Date.now() - metadata.lastRefresh.getTime();
        return age > this.CACHE_TTL_MS;
    }

    /**
     * 🔄 Refresh queue from database (source of truth)
     */
    private async refreshVendorQueue(vendorId: string): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            // ALWAYS rebuild from database (source of truth)
            const appointments = await this.appointmentModel
                .find({
                    vendor: new Types.ObjectId(vendorId),
                    appointment_time: { $gte: today },
                    status: { $in: ['pending', 'confirm'] },
                })
                .populate('user vendor service')
                .lean();

            this.buildVendorQueue(vendorId, appointments);

            this.logger.debug(`🔄 Refreshed queue for vendor ${vendorId} from database`);
        } catch (error) {
            this.logger.error(`❌ Failed to refresh queue for vendor ${vendorId}:`, error);
            throw error;
        }
    }

    /**
     * 👤 Get queue position for a user
     * Uses cache for speed, refreshes if stale
     */
    async getQueuePosition(userId: string, vendorId: string): Promise<QueueItem | null> {
        // Refresh cache if stale
        if (this.isCacheStale(vendorId)) {
            this.logger.debug(`🔄 Cache stale for vendor ${vendorId}, refreshing from DB...`);
            await this.refreshVendorQueue(vendorId);
        }

        const queue = this.queueCache.get(vendorId);
        if (!queue) {
            // No cache? Build from DB
            await this.refreshVendorQueue(vendorId);
            const newQueue = this.queueCache.get(vendorId);
            if (!newQueue) return null;
            return newQueue.find(item => item.userId === userId) || null;
        }

        return queue.find(item => item.userId === userId) || null;
    }

    /**
     * ➕ Join queue (called when appointment is created)
     */
    async joinQueue(appointmentId: string): Promise<QueueItem> {
        // Appointment is ALREADY in database (created by AppointmentService)
        const appointment = await this.appointmentModel
            .findById(appointmentId)
            .populate('user vendor service')
            .lean();

        if (!appointment) {
            throw new Error('Appointment not found in database');
        }

        const vendorId = (appointment.vendor as any)._id.toString();
        const userId = (appointment.user as any)._id.toString();

        // Force refresh from DB to get accurate position
        await this.refreshVendorQueue(vendorId);

        const position = await this.getQueuePosition(userId, vendorId);

        if (!position) {
            throw new Error('Failed to get queue position after joining');
        }

        // Send notification asynchronously
        this.notifyQueuePosition(position, appointment).catch(error => {
            this.logger.error('Failed to send queue position notification:', error);
        });

        this.logger.log(`✅ User ${userId} joined queue at position ${position.position}`);

        return position;
    }

    /**
     * ➖ Leave queue (called when appointment is cancelled/completed)
     */
    async leaveQueue(appointmentId: string): Promise<void> {
        // Appointment status is ALREADY updated in database
        const appointment = await this.appointmentModel
            .findById(appointmentId)
            .populate('vendor')
            .lean();

        if (!appointment) {
            this.logger.warn(`⚠️ Appointment ${appointmentId} not found`);
            return;
        }

        const vendorId = (appointment.vendor as any)._id.toString();

        // Refresh queue from DB (appointment will be excluded due to status)
        await this.refreshVendorQueue(vendorId);

        this.logger.log(`✅ Appointment ${appointmentId} removed from queue`);
    }

    /**
     * 💳 Update queue when payment is confirmed
     */
    async updateQueueOnPayment(appointmentId: string): Promise<void> {
        // Payment status is ALREADY updated in database
        const appointment = await this.appointmentModel
            .findById(appointmentId)
            .populate('vendor user service')
            .lean();

        if (!appointment) {
            this.logger.warn(`⚠️ Appointment ${appointmentId} not found`);
            return;
        }

        const vendorId = (appointment.vendor as any)._id.toString();
        const userId = (appointment.user as any)._id.toString();

        // Get old position
        const oldPosition = await this.getQueuePosition(userId, vendorId);

        // Refresh from DB (paid customers get priority)
        await this.refreshVendorQueue(vendorId);

        // Get new position
        const newPosition = await this.getQueuePosition(userId, vendorId);

        if (newPosition) {
            const positionChange = oldPosition ? oldPosition.position - newPosition.position : 0;

            // Send notification
            this.notificationService.sendNotification({
                recipient: userId,
                title: '🎉 Payment Confirmed!',
                body: positionChange > 0
                    ? `You've moved up ${positionChange} positions to #${newPosition.position}!`
                    : `You're at position #${newPosition.position} in the priority queue!`,
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
                    positionChange,
                },
                actionUrl: `/appointments/${appointmentId}`,
                externalId: appointmentId,
                tags: ['queue', 'payment', 'priority'],
                sound: 'success',
                icon: '💳',
            }).catch(error => {
                this.logger.error('Failed to send payment notification:', error);
            });

            this.logger.log(
                `💳 Payment confirmed for ${appointmentId}. ` +
                `Position: ${oldPosition?.position || 'N/A'} → ${newPosition.position}`
            );
        }
    }

    /**
     * 📋 Get vendor queue
     */
    async getVendorQueue(vendorId: string): Promise<QueueItem[]> {
        // Refresh if stale
        if (this.isCacheStale(vendorId)) {
            await this.refreshVendorQueue(vendorId);
        }

        return this.queueCache.get(vendorId) || [];
    }

    /**
     * 🧹 Cleanup stale caches (prevent memory leaks)
     */
    @Cron(CronExpression.EVERY_HOUR)
    private async cleanupStaleCaches() {
        this.logger.debug('🧹 Running cache cleanup...');

        const now = Date.now();
        let cleanedCount = 0;

        for (const [vendorId, metadata] of this.cacheMetadata.entries()) {
            const age = now - metadata.lastRefresh.getTime();

            // Remove if older than 1 hour or empty
            if (age > 60 * 60 * 1000 || metadata.itemCount === 0) {
                this.queueCache.delete(vendorId);
                this.cacheMetadata.delete(vendorId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.log(`🧹 Cleaned ${cleanedCount} stale cache entries`);
        }
    }

    /**
     * ⏰ Send 15-minute reminders
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async sendAppointmentReminders() {
        const now = new Date();
        const reminderTime = new Date(now.getTime() + 15 * 60 * 1000);

        try {
            const upcomingAppointments = await this.appointmentModel
                .find({
                    appointment_time: {
                        $gte: now,
                        $lte: reminderTime,
                    },
                    status: { $in: ['pending', 'confirm'] },
                })
                .populate('user vendor service')
                .lean();

            for (const appointment of upcomingAppointments) {
                const existingNotification = await this.notificationModel.findOne({
                    recipient: (appointment.user as any)._id,
                    externalId: appointment._id.toString(),
                    type: NotificationType.VENDOR,
                    title: 'Appointment Reminder',
                    sentAt: { $exists: true },
                });

                if (!existingNotification) {
                    await this.notificationService.sendNotification({
                        recipient: (appointment.user as any)._id.toString(),
                        title: '⏰ Appointment Reminder',
                        body: `Your appointment at ${(appointment.vendor as any).name} is in 15 minutes!`,
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

                    this.logger.log(`⏰ Sent reminder for appointment ${appointment._id}`);
                }
            }
        } catch (error) {
            this.logger.error('❌ Failed to send reminders:', error);
        }
    }

    /**
     * 💬 Vendor sends notification
     */
    async sendVendorNotification(
        vendorId: string,
        userId: string,
        message: string,
        appointmentId?: string,
    ): Promise<void> {
        const vendor = await this.vendorModel.findById(vendorId).lean();

        if (!vendor) {
            throw new Error('Vendor not found');
        }

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

        this.logger.log(`💬 Vendor notification sent to user ${userId}`);
    }

    /**
     * 📊 Send queue position notification
     */
    private async notifyQueuePosition(position: QueueItem, appointment?: any): Promise<void> {
        const vendor = appointment?.vendor as any;
        const service = appointment?.service as any;

        let body = '';
        let icon = '';
        let priority = NotificationPriority.NORMAL;

        if (position.position === 1) {
            body = `You're next in line at ${vendor?.name}! Please be ready.`;
            icon = '🎯';
            priority = NotificationPriority.HIGH;
        } else if (position.isPaid) {
            body = `You're at position #${position.position} (Priority Queue). Wait: ~${position.estimatedWaitTime} min.`;
            icon = '⭐';
        } else {
            body = `You're at position #${position.position}. Wait: ~${position.estimatedWaitTime} min.`;
            icon = '📍';
        }

        await this.notificationService.sendNotification({
            recipient: position.userId,
            title: '📊 Queue Position',
            body,
            type: NotificationType.VENDOR,
            priority,
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
    }

    /**
     * 🔔 Notify queue movement
     */
    async notifyQueueMovement(vendorId: string): Promise<void> {
        const queue = this.queueCache.get(vendorId);
        if (!queue || queue.length === 0) return;

        const notifications: Promise<any>[] = [];

        // Notify first customer
        if (queue[0]) {
            const appointment = await this.appointmentModel
                .findById(queue[0].appointmentId)
                .populate('vendor service')
                .lean();

            if (appointment) {
                notifications.push(
                    this.notificationService.sendNotification({
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
                    })
                );
            }
        }

        // Notify second customer
        if (queue[1]) {
            notifications.push(
                this.notificationService.sendNotification({
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
                    icon: '⏳',
                })
            );
        }

        await Promise.allSettled(notifications);
    }

    /**
     * 📈 Get cache statistics
     */
    getCacheStats() {
        return {
            totalVendors: this.queueCache.size,
            totalItems: Array.from(this.queueCache.values()).reduce(
                (sum, queue) => sum + queue.length,
                0
            ),
            oldestCache: Array.from(this.cacheMetadata.values())
                .map(m => m.lastRefresh)
                .sort((a, b) => a.getTime() - b.getTime())[0],
        };
    }

    /**
     * 🔧 Admin: Force rebuild all queues
     */
    async forceRebuildAllQueues() {
        this.logger.log('🔄 Admin triggered: Force rebuilding all queues...');
        return await this.initializeQueuesFromDatabase();
    }
}