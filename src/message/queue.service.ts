import { Appointment } from '@/schemas/appointment.schema';
import { NotificationType } from '@/schemas/notification.schema';
import { User } from '@/schemas/user.schema';
import { Vendor } from '@/schemas/vendor.schema';
import { ChatGateway } from '@/socket/chat.gateway';
import { forwardRef, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

interface QueuePosition {
    appointmentId: string;
    userId: string;
    position: number;
    estimatedWaitTime: number;
    isPaid: boolean;
}

@Injectable()
export class QueueService {
    constructor(
        @InjectModel(Appointment.name)
        private appointmentModel: Model<Appointment>,
        @InjectModel(Vendor.name)
        private vendorModel: Model<Vendor>,
        @Inject(forwardRef(() => ChatGateway))
        private chatGateway: ChatGateway,
    ) { }

    /**
     * Get user's queue position for today's appointments at a vendor
     */
    async getUserQueuePosition(userId: string, vendorId: string): Promise<QueuePosition | null> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Get user's appointment
            const userAppointment = await this.appointmentModel
                .findOne({
                    user: userId,
                    vendor: vendorId,
                    status: { $in: ['pending', 'confirm'] },
                    appointment_time: { $gte: today, $lt: tomorrow }
                })
                .populate('service', 'duration');

            if (!userAppointment) return null;

            // Calculate position based on priority rules
            const position = await this.calculateQueuePosition(userAppointment);

            return {
                appointmentId: userAppointment._id.toString(),
                userId,
                position,
                estimatedWaitTime: position * 30, // Assuming 30 min per appointment
                isPaid: userAppointment.payment_status === 'success'
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }

    /**
     * Calculate queue position with priority for paid appointments
     */
    private async calculateQueuePosition(appointment: any): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get all appointments for the vendor today
        const allAppointments = await this.appointmentModel
            .find({
                vendor: appointment.vendor,
                status: { $in: ['pending', 'confirm', 'ongoing'] },
                appointment_time: { $gte: today, $lt: tomorrow }
            })
            .sort({ appointment_time: 1 })
            .populate('service', 'duration');

        // Separate paid and unpaid
        const paidAppointments = allAppointments.filter(
            apt => apt.payment_status === 'success' && apt.status !== 'completed'
        );
        const unpaidAppointments = allAppointments.filter(
            apt => apt.payment_status !== 'success' && apt.status !== 'completed'
        );

        // Priority queue: paid first, then by appointment time
        const sortedQueue = [...paidAppointments, ...unpaidAppointments];

        const position = sortedQueue.findIndex(
            apt => apt._id.toString() === appointment._id.toString()
        );

        return position + 1;
    }

    /**
     * Get full queue for a vendor
     */
    async getVendorQueue(vendorId: string): Promise<QueuePosition[]> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const appointments = await this.appointmentModel
                .find({
                    vendor: vendorId,
                    status: { $in: ['pending', 'confirm', 'ongoing'] },
                    appointment_time: { $gte: today, $lt: tomorrow }
                })
                .populate('user', 'first_name last_name')
                .populate('service', 'duration')
                .sort({ payment_status: -1, appointment_time: 1 });

            const queue: QueuePosition[] = [];

            for (let i = 0; i < appointments.length; i++) {
                const apt = appointments[i];
                queue.push({
                    appointmentId: apt._id.toString(),
                    userId: apt.user._id.toString(),
                    position: i + 1,
                    estimatedWaitTime: i * 30,
                    isPaid: apt.payment_status === 'success'
                });
            }

            return queue;
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }

    /**
     * Notify user when their turn is approaching (position <= 2)
     */
    async checkAndNotifyUpcomingAppointments(): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Get all active appointments today
            const appointments = await this.appointmentModel
                .find({
                    status: { $in: ['pending', 'confirm'] },
                    appointment_time: { $gte: today, $lt: tomorrow }
                })
                .populate('user vendor service');

            // Group by vendor
            const vendorGroups = appointments.reduce((acc, apt) => {
                const vendorId = apt.vendor._id.toString();
                if (!acc[vendorId]) acc[vendorId] = [];
                acc[vendorId].push(apt);
                return acc;
            }, {});

            // Check each vendor's queue
            for (const [vendorId, vendorAppointments] of Object.entries(vendorGroups)) {
                const queue = await this.getVendorQueue(vendorId);

                // Notify users at position 1 and 2
                for (const queueItem of queue) {
                    if (queueItem.position === 1) {
                        await this.notifyUserTurn(queueItem, 'Your turn is now!');
                    } else if (queueItem.position === 2) {
                        await this.notifyUserTurn(queueItem, 'You\'re next in line!');
                    }
                }
            }
        } catch (error) {
            console.error('Error checking upcoming appointments:', error);
        }
    }

    /**
     * Notify specific user about their queue position
     */
    private async notifyUserTurn(queueItem: QueuePosition, message: string): Promise<void> {
        const appointment = await this.appointmentModel
            .findById(queueItem.appointmentId)
            .populate<{ user: User }>('user', 'first_name last_name email avatar')
            .populate<{ vendor: Vendor }>({
                path: 'vendor',
                select: 'name logo cover type address mobile',
            });

        await this.chatGateway.sendNotificationToUser(
            queueItem.userId,
            'Your Turn Approaching',
            `${message} Position: ${queueItem.position} at ${appointment.vendor.name}`,
            NotificationType.BOOKING,
            {
                appointmentId: queueItem.appointmentId,
                position: queueItem.position,
                vendorId: appointment.vendor._id.toString(),
                estimatedWaitTime: queueItem.estimatedWaitTime
            },
            {
                actionUrl: `/appointments/${queueItem.appointmentId}`,
                priority: 'high'
            }
        );

        // Emit real-time queue update
        this.chatGateway.server
            .to(`user:${queueItem.userId}`)
            .emit('queue-update', {
                position: queueItem.position,
                estimatedWaitTime: queueItem.estimatedWaitTime,
                message,
                timestamp: new Date()
            });
    }

    /**
     * Manual notification by vendor to specific user
     */
    async vendorNotifyUser(
        vendorId: string,
        appointmentId: string,
        customMessage?: string
    ): Promise<{ success: boolean; message: string }> {
        try {

            const appointment = await this.appointmentModel
                .findOne({ _id: appointmentId, vendor: vendorId })
                .populate<{ user: User }>('user', 'first_name last_name email avatar')
                .populate<{ vendor: Vendor }>({
                    path: 'vendor',
                    select: 'name logo cover type address mobile',
                });


            if (!appointment) {
                return { success: false, message: 'Appointment not found' };
            }

            const position = await this.calculateQueuePosition(appointment);
            const message = customMessage || `It's your turn at ${appointment.vendor.name}!`;

            await this.chatGateway.sendNotificationToUser(
                appointment.user._id.toString(),
                'Vendor Notification',
                message,
                NotificationType.BOOKING,
                {
                    appointmentId: appointment._id.toString(),
                    vendorId: vendorId,
                    position
                },
                {
                    actionUrl: `/appointments/${appointmentId}`,
                    priority: 'urgent'
                }
            );

            // Real-time notification
            this.chatGateway.server
                .to(`user:${appointment.user._id.toString()}`)
                .emit('vendor-notification', {
                    appointmentId: appointment._id.toString(),
                    message,
                    position,
                    timestamp: new Date()
                });

            return { success: true, message: 'User notified successfully' };
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }

    /**
     * Update appointment status and notify next users
     */
    async moveQueueForward(appointmentId: string): Promise<void> {
        try {
            const appointment = await this.appointmentModel.findById(appointmentId);
            if (!appointment) return;

            // Mark appointment as completed
            await this.appointmentModel.findByIdAndUpdate(appointmentId, {
                status: 'completed'
            });

            // Get updated queue
            const queue = await this.getVendorQueue(appointment.vendor.toString());

            // Notify top 2 positions
            if (queue.length > 0 && queue[0]) {
                await this.notifyUserTurn(queue[0], 'Your turn is now!');
            }
            if (queue.length > 1 && queue[1]) {
                await this.notifyUserTurn(queue[1], 'You\'re next in line!');
            }

            // Broadcast queue update to all users in vendor queue
            queue.forEach(item => {
                this.chatGateway.server
                    .to(`user:${item.userId}`)
                    .emit('queue-position-update', {
                        position: item.position,
                        estimatedWaitTime: item.estimatedWaitTime,
                        timestamp: new Date()
                    });
            });
        } catch (error) {
            console.error('Error moving queue forward:', error);
        }
    }
}