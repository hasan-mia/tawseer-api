import { QueueManagementService } from '@/queueManagement/queue.service';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    namespace: '/queue',
})
export class QueueGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    public server: Server;

    private readonly logger = new Logger(QueueGateway.name);
    private connectedUsers: Map<string, string> = new Map();

    constructor(
        private readonly queueService: QueueManagementService,
        private readonly jwtService: JwtService,
    ) { }

    afterInit(server: Server) {
        this.logger.log('Queue Socket.io Initialized');
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);

        const token =
            client.handshake.auth.token ||
            client.handshake.headers.authorization?.split(' ')[1] ||
            client.handshake.query.token;

        if (!token) {
            this.logger.warn(`No token provided, disconnecting socket ${client.id}`);
            client.emit('auth_error', { message: 'No authentication token provided' });
            client.disconnect();
            return;
        }

        try {
            const payload = this.jwtService.verify(token);
            const userId = payload.sub || payload.id || payload._id;

            if (!userId) {
                throw new Error('Invalid user ID in token');
            }

            this.connectedUsers.set(userId.toString(), client.id);
            client.data.userId = userId.toString();
            client.data.authenticated = true;

            this.logger.log(`User ${userId} authenticated with socket ${client.id}`);
        } catch (error) {
            this.logger.error(`JWT verification failed: ${error.message}`);
            client.emit('auth_error', { message: 'Invalid or expired token' });
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        for (const [userId, socketId] of this.connectedUsers.entries()) {
            if (socketId === client.id) {
                this.connectedUsers.delete(userId);
                this.logger.log(`User ${userId} disconnected`);
                break;
            }
        }
    }

    /**
     * Join vendor queue
     */
    @SubscribeMessage('join-vendor-queue')
    async handleJoinQueue(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: { vendorId: string; userId: string; appointmentId: string },
    ) {
        try {
            this.logger.log(`User ${data.userId} joining queue for vendor ${data.vendorId}`);

            // Add small delay to ensure appointment is in database
            await new Promise(resolve => setTimeout(resolve, 100));

            const position = await this.queueService.joinQueue(data.appointmentId);

            if (!position) {
                throw new Error('Failed to get queue position after joining');
            }

            // Emit to the user who joined
            client.emit('queue-position-update', {
                position: position.position,
                estimatedWaitTime: position.estimatedWaitTime,
                isPaid: position.isPaid,
                appointmentId: data.appointmentId,
            });

            // Notify vendor
            this.server.to(`vendor-${data.vendorId}`).emit('queue-update', {
                action: 'customer-joined',
                userId: data.userId,
                position,
            });

            this.logger.log(`✅ User ${data.userId} joined queue at position ${position.position}`);

            return { success: true, position };
        } catch (error) {
            this.logger.error(`❌ Error joining queue: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message || 'Failed to join queue. Please try again.'
            };
        }
    }

    /**
     * Leave vendor queue
     */
    @SubscribeMessage('leave-vendor-queue')
    async handleLeaveQueue(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: { vendorId: string; userId: string; appointmentId: string },
    ) {
        try {
            this.logger.log(`User ${data.userId} leaving queue for vendor ${data.vendorId}`);

            await this.queueService.leaveQueue(data.appointmentId);

            this.server.to(`vendor-${data.vendorId}`).emit('queue-update', {
                action: 'customer-left',
                userId: data.userId,
            });

            this.logger.log(`✅ User ${data.userId} left queue successfully`);

            return { success: true };
        } catch (error) {
            this.logger.error(`❌ Error leaving queue: ${error.message}`);
            return {
                success: false,
                error: error.message || 'Failed to leave queue'
            };
        }
    }

    /**
     * Get current queue position
     */
    @SubscribeMessage('get-my-queue-position')
    async handleGetPosition(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { vendorId: string; userId: string },
    ) {
        try {
            this.logger.log(`User ${data.userId} requesting queue position for vendor ${data.vendorId}`);

            const position = await this.queueService.getQueuePosition(
                data.userId,
                data.vendorId,
            );

            if (!position) {
                this.logger.log(`User ${data.userId} is not in queue for vendor ${data.vendorId}`);
                return {
                    success: true,
                    position: null,
                    message: 'Not in queue'
                };
            }

            this.logger.log(`✅ Found position for user ${data.userId}: #${position.position}`);

            return { success: true, position };
        } catch (error) {
            this.logger.error(`❌ Error getting position: ${error.message}`);
            return {
                success: false,
                error: error.message || 'Failed to get queue position'
            };
        }
    }

    /**
     * Vendor subscribes to their queue updates
     */
    @SubscribeMessage('subscribe-vendor-queue')
    async handleVendorSubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { vendorId: string },
    ) {
        try {
            this.logger.log(`Vendor ${data.vendorId} subscribing to queue updates`);

            client.join(`vendor-${data.vendorId}`);
            const queue = await this.queueService.getVendorQueue(data.vendorId);

            client.emit('vendor-queue-data', { queue });

            this.logger.log(`✅ Vendor ${data.vendorId} subscribed to queue (${queue.length} items)`);

            return { success: true, message: 'Subscribed to vendor queue' };
        } catch (error) {
            this.logger.error(`❌ Error subscribing to vendor queue: ${error.message}`);
            return {
                success: false,
                error: error.message || 'Failed to subscribe to vendor queue'
            };
        }
    }

    /**
     * Vendor sends manual notification to customer
     */
    @SubscribeMessage('send-customer-notification')
    async handleVendorNotification(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: {
            vendorId: string;
            userId: string;
            message: string;
            appointmentId?: string;
        },
    ) {
        try {
            await this.queueService.sendVendorNotification(
                data.vendorId,
                data.userId,
                data.message,
                data.appointmentId,
            );

            const userSocketId = this.connectedUsers.get(data.userId);
            if (userSocketId) {
                this.server.to(userSocketId).emit('vendor-notification', {
                    vendorId: data.vendorId,
                    message: data.message,
                    appointmentId: data.appointmentId,
                    timestamp: new Date(),
                });
            }

            return { success: true };
        } catch (error) {
            this.logger.error(`Error sending notification: ${error.message}`);
            return {
                success: false,
                error: error.message || 'Failed to send notification'
            };
        }
    }

    /**
     * Broadcast queue position updates to all users in a vendor's queue
     */
    async broadcastQueueUpdate(vendorId: string) {
        try {
            this.logger.log(`Broadcasting queue update for vendor ${vendorId}`);

            const queue = await this.queueService.getVendorQueue(vendorId);

            for (const item of queue) {
                const socketId = this.connectedUsers.get(item.userId);
                if (socketId) {
                    this.server.to(socketId).emit('queue-position-update', {
                        position: item.position,
                        estimatedWaitTime: item.estimatedWaitTime,
                        isPaid: item.isPaid,
                        appointmentId: item.appointmentId,
                    });
                }
            }

            this.server.to(`vendor-${vendorId}`).emit('vendor-queue-data', { queue });

            this.logger.log(`✅ Broadcast complete for vendor ${vendorId} (${queue.length} users)`);
        } catch (error) {
            this.logger.error(`❌ Error broadcasting queue update: ${error.message}`);
        }
    }

    /**
     * Notify user of payment confirmation and position update
     */
    async notifyPaymentUpdate(
        userId: string,
        vendorId: string,
        appointmentId: string,
    ) {
        try {
            const position = await this.queueService.getQueuePosition(userId, vendorId);

            if (position) {
                const socketId = this.connectedUsers.get(userId);
                if (socketId) {
                    this.server.to(socketId).emit('payment-confirmed', {
                        position: position.position,
                        estimatedWaitTime: position.estimatedWaitTime,
                        isPaid: position.isPaid,
                        appointmentId,
                    });
                }
            }

            await this.broadcastQueueUpdate(vendorId);
        } catch (error) {
            this.logger.error(`Error notifying payment update: ${error.message}`);
        }
    }
}