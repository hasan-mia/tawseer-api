import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { Vendor } from '@/schemas/vendor.schema';
import { QueueGateway } from '@/socket/queue.gateway';
import {
    BadRequestException,
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpException,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueueItem, QueueManagementService } from './queue.service';

@Controller('queue')
export class QueueController {
    constructor(
        private queueService: QueueManagementService,
        private queueGateway: QueueGateway,
        @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    ) { }

    /**
     * Get queue position for current user at a vendor
     */
    @Get('position/:vendorId')
    @UseGuards(JwtAuthGuard)
    async getMyPosition(
        @Param('vendorId') vendorId: string,
        @Request() req
    ): Promise<{ success: boolean; data: QueueItem | null; message?: string }> {
        try {
            if (!vendorId || vendorId === 'undefined') {
                throw new BadRequestException('Vendor ID is required');
            }

            const userId = req.user.id;
            const position = await this.queueService.getQueuePosition(userId, vendorId);

            return {
                success: true,
                data: position,
                message: position
                    ? `You are at position #${position.position}`
                    : 'You are not currently in queue',
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message,
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get entire queue for a vendor (vendor owner only)
     */
    @Get('vendor/:vendorId')
    @UseGuards(JwtAuthGuard)
    async getVendorQueue(
        @Param('vendorId') vendorId: string,
        @Request() req
    ) {
        try {
            if (!vendorId || vendorId === 'undefined') {
                throw new BadRequestException('Vendor ID is required');
            }

            // Check if user owns this vendor
            const vendor = await this.vendorModel.findById(vendorId).lean();

            if (!vendor) {
                throw new NotFoundException('Vendor not found');
            }

            if (vendor.user.toString() !== req.user.id) {
                throw new ForbiddenException('You do not have access to this vendor queue');
            }

            const queue = await this.queueService.getVendorQueue(vendorId);

            return {
                success: true,
                data: queue,
                total: queue.length,
                paidCount: queue.filter(item => item.isPaid).length,
                unpaidCount: queue.filter(item => !item.isPaid).length,
                nextCustomer: queue[0] || null,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message || 'Failed to get vendor queue',
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Vendor sends manual notification to customer
     */
    @Post('vendor/notify')
    @UseGuards(JwtAuthGuard)
    async sendNotification(
        @Body()
        body: {
            vendorId: string;
            userId: string;
            message: string;
            appointmentId?: string;
        },
        @Request() req
    ) {
        try {
            // Validate input
            if (!body.vendorId || !body.userId || !body.message) {
                throw new BadRequestException('vendorId, userId, and message are required');
            }

            if (body.message.trim().length === 0) {
                throw new BadRequestException('Message cannot be empty');
            }

            if (body.message.length > 500) {
                throw new BadRequestException('Message must be less than 500 characters');
            }

            // Check if user owns this vendor
            const vendor = await this.vendorModel.findById(body.vendorId).lean();

            if (!vendor) {
                throw new NotFoundException('Vendor not found');
            }

            if (vendor.user.toString() !== req.user.id) {
                throw new ForbiddenException('You do not have access to this vendor');
            }

            // Send notification
            await this.queueService.sendVendorNotification(
                body.vendorId,
                body.userId,
                body.message.trim(),
                body.appointmentId,
            );

            return {
                success: true,
                message: 'Notification sent successfully',
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message || 'Failed to send notification',
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Manual queue refresh endpoint (vendor only)
     */
    @Post('refresh/:vendorId')
    @UseGuards(JwtAuthGuard)
    async refreshQueue(
        @Param('vendorId') vendorId: string,
        @Request() req
    ) {
        try {
            if (!vendorId || vendorId === 'undefined') {
                throw new BadRequestException('Vendor ID is required');
            }

            // Check if user owns this vendor
            const vendor = await this.vendorModel.findById(vendorId).lean();

            if (!vendor) {
                throw new NotFoundException('Vendor not found');
            }

            if (vendor.user.toString() !== req.user.id) {
                throw new ForbiddenException('You do not have access to this vendor');
            }

            // Use public method instead of accessing private method
            await this.queueService.getVendorQueue(vendorId);

            // Broadcast update to all connected clients
            await this.queueGateway.broadcastQueueUpdate(vendorId);

            return {
                success: true,
                message: 'Queue refreshed successfully',
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message || 'Failed to refresh queue',
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * ⚠️ DEPRECATED: Use webhook from payment service instead
     * Webhook to handle payment confirmations
     * 
     * NOTE: This should be called internally by your payment service,
     * not exposed as a public API endpoint
     */
    @Post('payment-webhook')
    async handlePaymentWebhook(
        @Body() body: { appointmentId: string; signature?: string }
    ) {
        try {
            // ✅ TODO: Verify webhook signature for security
            // const isValid = await this.verifyWebhookSignature(body.signature, body);
            // if (!isValid) {
            //     throw new ForbiddenException('Invalid webhook signature');
            // }

            if (!body.appointmentId) {
                throw new BadRequestException('appointmentId is required');
            }

            // Update queue based on payment
            await this.queueService.updateQueueOnPayment(body.appointmentId);

            // Get appointment details for broadcasting
            const appointment = await this.queueService['appointmentModel']
                .findById(body.appointmentId)
                .populate('vendor user')
                .lean();

            if (!appointment) {
                throw new NotFoundException('Appointment not found');
            }

            // Notify the user who paid
            await this.queueGateway.notifyPaymentUpdate(
                (appointment.user as any)._id.toString(),
                (appointment.vendor as any)._id.toString(),
                body.appointmentId,
            );

            // Broadcast queue update to all users in this vendor's queue
            await this.queueGateway.broadcastQueueUpdate(
                (appointment.vendor as any)._id.toString()
            );

            return {
                success: true,
                message: 'Payment processed and queue updated',
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message || 'Failed to process payment webhook',
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get cache statistics (admin/monitoring only)
     */
    @Get('admin/stats')
    @UseGuards(JwtAuthGuard) // Add AdminGuard here
    async getCacheStats(@Request() req) {
        try {
            // ✅ TODO: Add admin role check
            // if (req.user.role !== 'admin') {
            //     throw new ForbiddenException('Admin access required');
            // }

            const stats = this.queueService.getCacheStats();

            return {
                success: true,
                data: stats,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message || 'Failed to get cache stats',
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Force rebuild all queues from database (admin only)
     */
    @Post('admin/rebuild')
    @UseGuards(JwtAuthGuard) // Add AdminGuard here
    async forceRebuildQueues(@Request() req) {
        try {
            // ✅ TODO: Add admin role check
            // if (req.user.role !== 'admin') {
            //     throw new ForbiddenException('Admin access required');
            // }

            const result = await this.queueService.forceRebuildAllQueues();

            return {
                success: true,
                message: 'All queues rebuilt from database',
                data: result,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message || 'Failed to rebuild queues',
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get queue statistics for a vendor
     */
    @Get('vendor/:vendorId/stats')
    @UseGuards(JwtAuthGuard)
    async getQueueStats(
        @Param('vendorId') vendorId: string,
        @Request() req
    ) {
        try {
            if (!vendorId || vendorId === 'undefined') {
                throw new BadRequestException('Vendor ID is required');
            }

            // Authorization check
            const vendor = await this.vendorModel.findById(vendorId).lean();

            if (!vendor) {
                throw new NotFoundException('Vendor not found');
            }

            if (vendor.user.toString() !== req.user.id) {
                throw new ForbiddenException('You do not have access to this vendor');
            }

            const queue = await this.queueService.getVendorQueue(vendorId);

            const stats = {
                total: queue.length,
                paidCount: queue.filter(item => item.isPaid).length,
                unpaidCount: queue.filter(item => !item.isPaid).length,
                averageWaitTime: queue.length > 0
                    ? Math.round(queue.reduce((sum, item) => sum + item.estimatedWaitTime, 0) / queue.length)
                    : 0,
                nextCustomer: queue[0] || null,
                longestWait: queue.length > 0
                    ? Math.max(...queue.map(item => item.estimatedWaitTime))
                    : 0,
            };

            return {
                success: true,
                data: stats,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: error.message || 'Failed to get queue statistics',
                },
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}