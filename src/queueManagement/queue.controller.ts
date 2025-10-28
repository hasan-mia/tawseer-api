import { QueueGateway } from '@/socket/queue.gateway';
import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Request
} from '@nestjs/common';
import { QueueItem, QueueManagementService } from './queue.service';

@Controller('queue')
export class QueueController {
    constructor(
        private queueService: QueueManagementService,
        private queueGateway: QueueGateway,
    ) { }

    /**
     * Get queue position for current user at a vendor
     */
    @Get('position/:vendorId')
    async getMyPosition(@Param('vendorId') vendorId: string, @Request() req): Promise<{ success: boolean; data: QueueItem | null }> {
        const userId = req.user.id; // Assuming JWT auth middleware
        const position = await this.queueService.getQueuePosition(userId, vendorId);

        return {
            success: true,
            data: position,
        };
    }

    /**
     * Get entire queue for a vendor (vendor only)
     */
    @Get('vendor/:vendorId')
    async getVendorQueue(@Param('vendorId') vendorId: string, @Request() req) {
        // Add authorization check to ensure user is vendor owner
        const queue = await this.queueService.getVendorQueue(vendorId);

        return {
            success: true,
            data: queue,
        };
    }

    /**
     * Vendor sends manual notification to customer
     */
    @Post('vendor/notify')
    async sendNotification(
        @Body()
        body: {
            vendorId: string;
            userId: string;
            message: string;
            appointmentId?: string;
        },
    ) {
        await this.queueService.sendVendorNotification(
            body.vendorId,
            body.userId,
            body.message,
            body.appointmentId,
        );

        // Trigger real-time notification via WebSocket
        await this.queueGateway.notifyPaymentUpdate(
            body.userId,
            body.vendorId,
            body.appointmentId,
        );

        return {
            success: true,
            message: 'Notification sent successfully',
        };
    }

    /**
     * Webhook to handle payment confirmations
     */
    @Post('payment-webhook')
    async handlePaymentWebhook(@Body() body: { appointmentId: string }) {
        await this.queueService.updateQueueOnPayment(body.appointmentId);

        // Broadcast queue updates to all users
        const appointment = await this.queueService['appointmentModel']
            .findById(body.appointmentId)
            .populate('vendor user');

        if (appointment) {
            await this.queueGateway.notifyPaymentUpdate(
                (appointment.user as any)._id.toString(),
                (appointment.vendor as any)._id.toString(),
                body.appointmentId,
            );
        }

        return {
            success: true,
            message: 'Payment processed and queue updated',
        };
    }

    /**
     * Manual queue refresh endpoint
     */
    @Post('refresh/:vendorId')
    async refreshQueue(@Param('vendorId') vendorId: string) {
        await this.queueService['refreshVendorQueue'](vendorId);
        await this.queueGateway.broadcastQueueUpdate(vendorId);

        return {
            success: true,
            message: 'Queue refreshed successfully',
        };
    }
}