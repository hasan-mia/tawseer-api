import { MessageService } from '@/message/message.service';
import { NotificationService } from '@/notification/notification.service';
import { Conversation } from '@/schemas/conversation.schema';
import { NotificationType } from '@/schemas/notification.schema';
import { User } from '@/schemas/user.schema';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer
} from '@nestjs/websockets';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';

interface ConnectedUser {
    userId: string;
    socketId: string;
    joinedAt: Date;
    lastSeen: Date;
}

interface CleanupStats {
    lastRun: Date | null;
    totalCleaned: number;
    errors: number;
}

@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    namespace: '/chat',
})
@Injectable()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer()
    public server: Server;

    // Connection tracking
    private readonly connectedUsers = new Map<string, ConnectedUser>();
    private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
    private readonly typingUsers = new Map<string, Set<string>>();
    private readonly statusBroadcastQueue = new Map<string, NodeJS.Timeout>();
    private readonly processingMessages = new Set<string>();

    // Cleanup configuration
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private readonly STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
    private readonly HEARTBEAT_DB_UPDATE_INTERVAL = 10; // Update DB every 10 heartbeats
    private readonly MESSAGE_DUPLICATE_TIMEOUT = 2000; // 2 seconds
    private readonly STATUS_BROADCAST_DEBOUNCE = 1000; // 1 second

    // Metrics
    private cleanupStats: CleanupStats = {
        lastRun: null,
        totalCleaned: 0,
        errors: 0
    };

    constructor(
        @InjectModel(Conversation.name)
        private conversationModel: Model<Conversation>,
        @InjectModel(User.name)
        private userModel: Model<User>,
        private messageService: MessageService,
        private notificationService: NotificationService,
        private jwtService: JwtService
    ) { }

    // ============ LIFECYCLE HOOKS ============

    afterInit(server: Server) {
        console.log('🚀 Chat Socket.io Initialized');
        this.startCleanupInterval();
    }

    async handleConnection(socket: Socket) {
        try {
            console.log(`🔌 Client attempting connection: ${socket.id}`);

            // Extract and verify token
            const token = this.extractToken(socket);
            if (!token) {
                this.handleAuthError(socket, 'No authentication token provided');
                return;
            }

            // Verify JWT and extract user ID
            const userId = await this.verifyTokenAndGetUserId(token);
            if (!userId) {
                this.handleAuthError(socket, 'Invalid authentication token');
                return;
            }

            // Register connection
            await this.registerConnection(socket, userId);

            console.log(`✅ User ${userId} authenticated with socket ${socket.id}`);

        } catch (error) {
            console.error('❌ Socket connection error:', error);
            this.handleAuthError(socket, 'Authentication failed');
        }
    }

    async handleDisconnect(socket: Socket) {
        console.log(`🔌 Client disconnected: ${socket.id}`);

        const connectedUser = this.connectedUsers.get(socket.id);
        if (!connectedUser) {
            return;
        }

        await this.unregisterConnection(socket.id, connectedUser.userId);
    }

    async onModuleDestroy() {
        console.log('🛑 Shutting down ChatGateway...');

        // Stop cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('✅ Cleanup interval stopped');
        }

        // Clear all pending timeouts
        this.clearAllPendingTimeouts();

        // Disconnect all clients gracefully
        await this.disconnectAllClients();

        console.log('✅ ChatGateway shutdown complete');
    }

    // ============ CONVERSATION MANAGEMENT ============

    @SubscribeMessage('join-conversation')
    async handleJoinConversation(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return this.emitError(socket, 'join-conversation', 'Not authenticated');
            }

            const { conversationId } = data;
            const userId = socket.data.userId;

            // Verify user authorization
            const conversation = await this.conversationModel.findById(conversationId);
            if (!conversation) {
                return this.emitError(socket, 'join-conversation', 'Conversation not found');
            }

            if (!this.isUserInConversation(conversation, userId)) {
                return this.emitError(socket, 'join-conversation', 'Not authorized to join this conversation');
            }

            // Join room
            socket.join(`conversation:${conversationId}`);
            this.updateUserLastSeen(socket.id);

            console.log(`✅ Socket ${socket.id} (User ${userId}) joined conversation: ${conversationId}`);

            socket.emit('join-conversation', {
                conversationId,
                success: true,
                message: 'Successfully joined conversation'
            });

        } catch (error) {
            console.error('❌ Error joining conversation:', error);
            this.emitError(socket, 'join-conversation', error.message);
        }
    }

    @SubscribeMessage('leave-conversation')
    handleLeaveConversation(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return { event: 'leave-conversation', data: { success: false, error: 'Not authenticated' } };
            }

            const { conversationId } = data;
            const userId = socket.data.userId;

            socket.leave(`conversation:${conversationId}`);
            this.removeFromTyping(conversationId, userId);

            console.log(`✅ Socket ${socket.id} (User ${userId}) left conversation: ${conversationId}`);

            return { event: 'leave-conversation', data: { conversationId, success: true } };
        } catch (error) {
            console.error('❌ Error leaving conversation:', error);
            return { event: 'leave-conversation', data: { success: false, error: error.message } };
        }
    }

    // ============ MESSAGE HANDLING ============

    @SubscribeMessage('get-messages')
    async handleGetMessages(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string; page?: number; limit?: number }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return this.emitError(socket, 'get-messages', 'Not authenticated');
            }

            const userId = socket.data.userId;
            this.updateUserLastSeen(socket.id);

            const mockReq = {
                query: {
                    page: data.page ?? 1,
                    limit: data.limit ?? 20
                },
                originalUrl: `/messages/${data.conversationId}`
            };

            const result = await this.messageService.getMessagesByConversation(
                data.conversationId,
                userId,
                mockReq
            );

            console.log(`📨 Messages fetched for conversation ${data.conversationId}, page ${data.page ?? 1}`);

            socket.emit('get-messages', result);

        } catch (error) {
            console.error('❌ Error fetching messages:', error);
            this.emitError(socket, 'get-messages', error.message);
        }
    }

    @SubscribeMessage('send-message')
    async handleSendMessage(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: {
            conversationId: string;
            content: string;
            attachments?: string[];
            tempId?: string;
        }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return this.emitMessageFailure(socket, data.tempId, 'Not authenticated');
            }

            const senderId = socket.data.userId;

            // Validate input
            if (!data.conversationId || !data.content?.trim()) {
                return this.emitMessageFailure(socket, data.tempId, 'Invalid message data');
            }

            // Prevent duplicate messages
            const messageKey = `${socket.id}-${data.tempId}`;
            if (this.processingMessages.has(messageKey)) {
                console.log('⚠️ Ignoring duplicate message from same socket with same tempId');
                return;
            }

            this.processingMessages.add(messageKey);
            this.updateUserLastSeen(socket.id);
            this.removeFromTyping(data.conversationId, senderId);

            try {
                await this.processAndBroadcastMessage(socket, data, senderId);
            } finally {
                // Clean up duplicate prevention
                setTimeout(() => {
                    this.processingMessages.delete(messageKey);
                }, this.MESSAGE_DUPLICATE_TIMEOUT);
            }

        } catch (error) {
            if (error.message !== "Duplicate message prevented") {
                console.error('❌ Error handling send message:', error);
                this.emitMessageFailure(socket, data.tempId, error.message);
            }
        }
    }

    @SubscribeMessage('mark-read')
    async handleMarkRead(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { messageId: string }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return { event: 'mark-read', data: { success: false, error: 'Not authenticated' } };
            }

            const userId = socket.data.userId;
            const { messageId } = data;

            const result = await this.messageService.markMessageAsRead(messageId, userId);
            this.updateUserLastSeen(socket.id);

            return { event: 'mark-read', data: result };
        } catch (error) {
            console.error('❌ Error marking message as read:', error);
            return { event: 'mark-read', data: { success: false, error: error.message } };
        }
    }

    @SubscribeMessage('typing')
    handleTyping(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string; isTyping: boolean }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return { event: 'typing', data: { success: false, error: 'Not authenticated' } };
            }

            const { conversationId, isTyping } = data;
            const userId = socket.data.userId;

            this.updateUserLastSeen(socket.id);

            if (isTyping) {
                this.addToTyping(conversationId, userId);
            } else {
                this.removeFromTyping(conversationId, userId);
            }

            // Broadcast typing status
            socket.to(`conversation:${conversationId}`).emit('user-typing', {
                userId,
                conversationId,
                isTyping
            });

            return { event: 'typing', data: { success: true } };
        } catch (error) {
            console.error('❌ Error handling typing:', error);
            return { event: 'typing', data: { success: false, error: error.message } };
        }
    }

    // ============ USER STATUS & PRESENCE ============

    @SubscribeMessage('get-online-status')
    async handleGetOnlineStatus(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { userIds: string[]; conversationId?: string }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return this.emitError(socket, 'get-online-status', 'Not authenticated');
            }

            const { userIds, conversationId } = data;

            // Get online status
            const onlineStatus = this.getOnlineStatusForUsers(userIds);
            const lastSeenInfo = await this.getLastSeenInfo(userIds);

            socket.emit('get-online-status', {
                success: true,
                status: onlineStatus,
                lastSeen: lastSeenInfo,
                timestamp: new Date()
            });

            // Get conversation presence if requested
            if (conversationId) {
                const conversationPresence = await this.getConversationPresence(conversationId);
                socket.emit('conversation-presence', {
                    conversationId,
                    presence: conversationPresence,
                    timestamp: new Date()
                });
            }

        } catch (error) {
            console.error('❌ Error getting online status:', error);
            this.emitError(socket, 'get-online-status', error.message);
        }
    }

    @SubscribeMessage('subscribe-user-status')
    async handleSubscribeUserStatus(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { userIds: string[] }
    ) {
        try {
            if (!this.isAuthenticated(socket)) {
                return this.emitError(socket, 'subscribe-user-status', 'Not authenticated');
            }

            const { userIds } = data;

            // Join status update rooms
            userIds.forEach(userId => {
                socket.join(`status-updates:${userId}`);
            });

            socket.emit('subscribe-user-status', {
                success: true,
                subscribedTo: userIds,
                message: 'Subscribed to user status updates'
            });

        } catch (error) {
            console.error('❌ Error subscribing to user status:', error);
            this.emitError(socket, 'subscribe-user-status', error.message);
        }
    }

    @SubscribeMessage('heartbeat')
    async handleHeartbeat(@ConnectedSocket() socket: Socket) {
        if (!this.isAuthenticated(socket)) {
            return;
        }

        const userId = socket.data.userId;
        this.updateUserLastSeen(socket.id);

        // Periodically update database
        if (!socket.data.heartbeatCount) {
            socket.data.heartbeatCount = 0;
        }
        socket.data.heartbeatCount++;

        if (socket.data.heartbeatCount % this.HEARTBEAT_DB_UPDATE_INTERVAL === 0) {
            await this.userModel.findByIdAndUpdate(userId, {
                lastSeen: new Date(),
                isOnline: true
            }).catch(err => console.error('Error updating heartbeat in DB:', err));
        }

        socket.emit('heartbeat-ack', { timestamp: new Date() });
    }

    // ============ NOTIFICATION EVENTS ============

    @SubscribeMessage('join-notifications')
    async handleJoinNotifications(@ConnectedSocket() socket: Socket) {
        if (!this.isAuthenticated(socket)) {
            return this.emitError(socket, 'join-notifications', 'Not authenticated');
        }

        const userId = socket.data.userId;
        socket.join(`notifications:${userId}`);

        // Send current counts
        const unreadCount = await this.notificationService.getUnreadCount(userId);
        const unreadMsg = await this.messageService.getUnreadMessageCount(userId);

        socket.emit('unread-count-update', {
            count: unreadCount,
            unreadMsgCount: unreadMsg.data,
            timestamp: new Date(),
        });

        socket.emit('join-notifications', {
            success: true,
            message: 'Successfully joined notifications',
            unreadCount
        });
    }

    @SubscribeMessage('get-notifications')
    async handleGetNotifications(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { page?: number; limit?: number; type?: string }
    ) {
        if (!this.isAuthenticated(socket)) {
            return this.emitError(socket, 'get-notifications', 'Not authenticated');
        }

        const userId = socket.data.userId;

        try {
            const notifications = await this.notificationService.getNotifications({
                recipient: userId,
                page: data.page || 1,
                limit: data.limit || 20,
                type: data.type as any,
            });

            socket.emit('get-notifications', notifications);
        } catch (error) {
            console.error('❌ Error getting notifications:', error);
            this.emitError(socket, 'get-notifications', error.message);
        }
    }

    @SubscribeMessage('get-unread-count')
    async handleGetUnreadCount(@ConnectedSocket() socket: Socket) {
        if (!this.isAuthenticated(socket)) return;

        const userId = socket.data.userId;
        const unreadNotificationCount = await this.notificationService.getUnreadCount(userId.toString());
        const unreadMsg = await this.messageService.getUnreadMessageCount(userId);

        socket.emit('unread-count-update', {
            count: unreadNotificationCount,
            unreadMsgCount: unreadMsg.data,
            timestamp: new Date(),
        });
    }

    // ============ PRIVATE HELPER METHODS ============

    private extractToken(socket: Socket): string | null {
        return socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1] ||
            socket.handshake.query.token as string ||
            null;
    }

    private async verifyTokenAndGetUserId(token: string): Promise<string | null> {
        try {
            const payload = this.jwtService.verify(token);
            const userId = payload.sub || payload.id || payload._id;
            return userId ? userId.toString() : null;
        } catch (error) {
            console.error('JWT verification failed:', error);
            return null;
        }
    }

    private handleAuthError(socket: Socket, message: string) {
        console.log(`⚠️ Auth error for socket ${socket.id}: ${message}`);
        socket.emit('auth_error', { message });
        socket.disconnect();
    }

    private async registerConnection(socket: Socket, userId: string) {
        // Track multiple connections per user
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);

        // Store connection info
        this.connectedUsers.set(socket.id, {
            userId,
            socketId: socket.id,
            joinedAt: new Date(),
            lastSeen: new Date()
        });

        // Setup socket data
        socket.data.userId = userId;
        socket.data.authenticated = true;

        // Join personal rooms
        socket.join(`user:${userId}`);
        socket.join(`notifications:${userId}`);

        // Update user online status
        await this.userModel.findByIdAndUpdate(userId, {
            isOnline: true,
            lastSeen: new Date()
        }).catch(err => console.error('Error updating user online status:', err));

        // Broadcast online status
        this.debouncedStatusBroadcast(userId, true);

        // Send connection success with unread counts
        const [unreadNotificationCount, unreadMsg] = await Promise.all([
            this.notificationService.getUnreadCount(userId),
            this.messageService.getUnreadMessageCount(userId)
        ]);

        socket.emit('connection_success', {
            message: 'Successfully connected',
            userId,
        });

        socket.emit('unread-count-update', {
            count: unreadNotificationCount,
            unreadMsgCount: unreadMsg.data,
            timestamp: new Date(),
        });
    }

    private async unregisterConnection(socketId: string, userId: string) {
        // Remove from connected users
        this.connectedUsers.delete(socketId);

        // Remove from user's socket set
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
            userSocketSet.delete(socketId);

            // If no more connections, user is offline
            if (userSocketSet.size === 0) {
                this.userSockets.delete(userId);

                // Update database
                await this.updateUserLastSeenInDB(userId);

                // Clean up and broadcast offline status
                this.removeFromAllTyping(userId);
                this.debouncedStatusBroadcast(userId, false);
            }

            console.log(`✅ User ${userId} disconnected. Remaining connections: ${userSocketSet.size}`);
        }
    }

    private async processAndBroadcastMessage(socket: Socket, data: any, senderId: string) {
        const { conversationId, content, attachments, tempId } = data;

        // Save message to database
        const messageResult = await this.messageService.sendMessage({
            senderId,
            conversationId,
            content: content.trim(),
            attachments: attachments || []
        });

        if (!messageResult.success || !messageResult.data) {
            this.emitMessageFailure(socket, tempId, 'Failed to save message');
            return;
        }

        console.log(`✅ Message sent successfully in conversation ${conversationId}`);

        // Emit success to sender
        socket.emit('send-message', {
            success: true,
            message: messageResult.data,
            tempId
        });

        // Broadcast to other participants in the conversation
        this.server.to(`conversation:${conversationId}`)
            .except(socket.id)
            .emit('new-message', {
                message: messageResult.data,
                conversationId,
            });

        // Handle notifications
        await this.sendMessageNotifications(conversationId, senderId, content, messageResult.data);
    }

    private async sendMessageNotifications(conversationId: string, senderId: string, content: string, messageData: any) {
        try {
            const conversation = await this.conversationModel
                .findById(conversationId)
                .populate('participants', 'first_name last_name avatar fcmToken');

            if (!conversation) return;

            const otherParticipants = conversation.participants.filter(
                (participant: any) => participant._id.toString() !== senderId
            );

            for (const participant of otherParticipants) {
                const participantId = participant._id.toString();

                // Get unread counts
                const [unreadNotificationCount, unreadData] = await Promise.all([
                    this.notificationService.getUnreadCount(participantId),
                    this.messageService.getUnreadMessageCount(participantId)
                ]);

                // Emit unread count update
                this.server.to(`user:${participantId}`).emit('unread-count-update', {
                    count: unreadNotificationCount,
                    unreadMsgCount: unreadData.data,
                    timestamp: new Date(),
                });

                // Send push notification if user is offline
                const isOnline = this.isUserOnline(participantId);
                if (!isOnline) {
                    const notificationBody = content.length > 100 ?
                        content.substring(0, 100) + '...' : content;

                    await this.notificationService.sendChatNotification(
                        senderId,
                        participantId,
                        conversationId,
                        notificationBody
                    ).catch(err => console.error('Error sending chat notification:', err));
                }
            }
        } catch (error) {
            console.error('❌ Error sending message notifications:', error);
        }
    }

    private isAuthenticated(socket: Socket): boolean {
        return socket.data.authenticated === true;
    }

    private isUserInConversation(conversation: any, userId: string): boolean {
        return conversation.participants.some((p: any) => p.toString() === userId);
    }

    private emitError(socket: Socket, event: string, error: string) {
        socket.emit(event, { success: false, error });
    }

    private emitMessageFailure(socket: Socket, tempId: string | undefined, error: string) {
        socket.emit('message-failure', {
            success: false,
            error,
            tempId
        });
    }

    private updateUserLastSeen(socketId: string) {
        const user = this.connectedUsers.get(socketId);
        if (user) {
            user.lastSeen = new Date();
        }
    }

    private async updateUserLastSeenInDB(userId: string) {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                lastSeen: new Date(),
                isOnline: false
            });
            console.log(`✅ Updated last seen for user ${userId}`);
        } catch (error) {
            console.error('❌ Error updating last seen in DB:', error);
        }
    }

    private addToTyping(conversationId: string, userId: string) {
        if (!this.typingUsers.has(conversationId)) {
            this.typingUsers.set(conversationId, new Set());
        }
        this.typingUsers.get(conversationId).add(userId);
    }

    private removeFromTyping(conversationId: string, userId: string) {
        const typingInConv = this.typingUsers.get(conversationId);
        if (typingInConv) {
            typingInConv.delete(userId);
            if (typingInConv.size === 0) {
                this.typingUsers.delete(conversationId);
            }
        }
    }

    private removeFromAllTyping(userId: string) {
        for (const [conversationId, typingSet] of this.typingUsers.entries()) {
            if (typingSet.has(userId)) {
                typingSet.delete(userId);

                // Broadcast that user stopped typing
                this.server.to(`conversation:${conversationId}`).emit('user-typing', {
                    userId,
                    conversationId,
                    isTyping: false
                });

                if (typingSet.size === 0) {
                    this.typingUsers.delete(conversationId);
                }
            }
        }
    }

    private debouncedStatusBroadcast(userId: string, isOnline: boolean) {
        // Clear existing timeout
        const existingTimeout = this.statusBroadcastQueue.get(userId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
            this.broadcastUserStatus(userId, isOnline);
            this.statusBroadcastQueue.delete(userId);
        }, this.STATUS_BROADCAST_DEBOUNCE);

        this.statusBroadcastQueue.set(userId, timeout);
    }

    private broadcastUserStatus(userId: string, isOnline: boolean) {
        this.server.to(`status-updates:${userId}`).emit('user-status-change', {
            userId,
            isOnline,
            timestamp: new Date()
        });

        console.log(`📡 Broadcasted: User ${userId} is ${isOnline ? 'online' : 'offline'}`);
    }

    private getOnlineStatusForUsers(userIds: string[]): Record<string, boolean> {
        return userIds.reduce((acc, userId) => {
            acc[userId] = this.isUserOnline(userId);
            return acc;
        }, {} as Record<string, boolean>);
    }

    private async getLastSeenInfo(userIds: string[]): Promise<Record<string, Date | null>> {
        const lastSeenInfo: Record<string, Date | null> = {};

        try {
            const users = await this.userModel
                .find({ _id: { $in: userIds } })
                .select('_id lastSeen isOnline');

            users.forEach((user: any) => {
                const userId = user._id.toString();
                const userSocketSet = this.userSockets.get(userId);

                if (userSocketSet && userSocketSet.size > 0) {
                    // User is online, get in-memory last seen
                    const socketId = Array.from(userSocketSet)[0];
                    const connectedUser = this.connectedUsers.get(socketId);
                    lastSeenInfo[userId] = connectedUser?.lastSeen || new Date();
                } else {
                    // User is offline, get from database
                    lastSeenInfo[userId] = user.lastSeen || null;
                }
            });

            // Fill missing users
            userIds.forEach(userId => {
                if (!lastSeenInfo[userId]) {
                    lastSeenInfo[userId] = null;
                }
            });

        } catch (error) {
            console.error('❌ Error fetching last seen info:', error);
            userIds.forEach(userId => {
                lastSeenInfo[userId] = null;
            });
        }

        return lastSeenInfo;
    }

    private async getConversationPresence(conversationId: string): Promise<Record<string, boolean>> {
        try {
            const conversation = await this.conversationModel
                .findById(conversationId)
                .populate('participants');

            if (!conversation) return {};

            const presence: Record<string, boolean> = {};
            conversation.participants.forEach((participant: any) => {
                const userId = participant._id.toString();
                presence[userId] = this.isUserOnline(userId);
            });

            return presence;
        } catch (error) {
            console.error('❌ Error getting conversation presence:', error);
            return {};
        }
    }

    // ============ CLEANUP METHODS ============

    private startCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleConnections();
        }, this.CLEANUP_INTERVAL);

        console.log(`🧹 Cleanup interval started: checking every ${this.CLEANUP_INTERVAL / 1000}s`);
    }

    private async cleanupStaleConnections() {
        try {
            if (!this.server?.sockets?.sockets) {
                console.log('⚠️ Server not initialized or already destroyed.');
                return;
            }

            const now = new Date();
            const staleConnections: string[] = [];

            // Collect stale connections
            for (const [socketId, user] of this.connectedUsers.entries()) {
                const timeSinceLastSeen = now.getTime() - user.lastSeen.getTime();

                if (timeSinceLastSeen > this.STALE_THRESHOLD) {
                    staleConnections.push(socketId);
                }
            }

            if (staleConnections.length === 0) {
                console.log('✅ No stale connections found');
                this.cleanupStats.lastRun = now;
                return;
            }

            console.log(`🧹 Cleaning up ${staleConnections.length} stale connection(s)`);

            // Process each stale connection
            let cleanedCount = 0;
            for (const socketId of staleConnections) {
                const success = await this.cleanupSingleConnection(socketId);
                if (success) cleanedCount++;
            }

            // Update stats
            this.cleanupStats.lastRun = now;
            this.cleanupStats.totalCleaned += cleanedCount;

            console.log(`✅ Cleanup completed: ${cleanedCount}/${staleConnections.length} connection(s) removed`);

        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            this.cleanupStats.errors++;
        }
    }

    private async cleanupSingleConnection(socketId: string): Promise<boolean> {
        try {
            const user = this.connectedUsers.get(socketId);
            if (!user) return false;

            const userId = user.userId;

            console.log(`🧹 Cleaning up stale connection: user ${userId}, socket ${socketId}`);

            // 1. Disconnect socket if it still exists
            const socket = this.server.sockets.sockets.get(socketId);
            if (socket) {
                socket.disconnect(true);
            }

            // 2. Remove from connected users
            this.connectedUsers.delete(socketId);

            // 3. Update userSockets map
            const userSocketSet = this.userSockets.get(userId);
            if (userSocketSet) {
                userSocketSet.delete(socketId);

                // If user has no more connections, handle offline status
                if (userSocketSet.size === 0) {
                    this.userSockets.delete(userId);

                    // Update database
                    await this.updateUserLastSeenInDB(userId);

                    // Broadcast offline status
                    this.debouncedStatusBroadcast(userId, false);
                }
            }

            // 4. Remove from typing indicators
            this.removeFromAllTyping(userId);

            return true;

        } catch (error) {
            console.error(`❌ Error cleaning up socket ${socketId}:`, error);
            return false;
        }
    }

    private clearAllPendingTimeouts() {
        // Clear status broadcast timeouts
        for (const timeout of this.statusBroadcastQueue.values()) {
            clearTimeout(timeout);
        }
        this.statusBroadcastQueue.clear();

        console.log('✅ Cleared all pending timeouts');
    }

    private async disconnectAllClients() {
        if (!this.server?.sockets?.sockets) {
            return;
        }

        const sockets = Array.from(this.server.sockets.sockets.values());

        for (const socket of sockets) {
            socket.disconnect(true);
        }

        console.log(`✅ Disconnected ${sockets.length} socket(s)`);
    }

    // ============ PUBLIC API METHODS ============

    public isUserOnline(userId: string): boolean {
        const userSocketSet = this.userSockets.get(userId);
        return userSocketSet ? userSocketSet.size > 0 : false;
    }

    public getUserConnectionCount(userId: string): number {
        const userSocketSet = this.userSockets.get(userId);
        return userSocketSet ? userSocketSet.size : 0;
    }

    public getOnlineUsers(): string[] {
        return Array.from(this.userSockets.keys());
    }

    public getTotalConnections(): number {
        return this.connectedUsers.size;
    }

    public getUniqueOnlineUsers(): number {
        return this.userSockets.size;
    }

    public getCleanupStats(): CleanupStats {
        return { ...this.cleanupStats };
    }

    public async notifyUserOfNewMessages(userId: string, unreadCount: number) {
        if (this.isUserOnline(userId)) {
            this.server.to(`user:${userId}`).emit('unread-count-update', {
                count: unreadCount,
                timestamp: new Date()
            });
        }
    }

    public async notifyUserStatusChange(userId: string, isOnline: boolean) {
        this.broadcastUserStatus(userId, isOnline);
    }

    // ============ NOTIFICATION API METHODS ============

    public async sendRealtimeNotification(userId: string, notificationData: any): Promise<boolean> {
        const userSocketSet = this.userSockets.get(userId);
        if (!userSocketSet || userSocketSet.size === 0) {
            return false;
        }

        try {
            // Create notification in database
            const notification = await this.notificationService.sendNotification({
                recipient: userId,
                title: notificationData.title,
                body: notificationData.body,
                type: notificationData.type,
                priority: notificationData.priority || 'normal',
                data: notificationData.data,
                actionUrl: notificationData.actionUrl,
                sendPush: false,
            });

            if (!notification.success) {
                return false;
            }

            // Send to all user's connected sockets
            this.server.to(`user:${userId}`).emit('new-notification', {
                notification: notification.data,
                timestamp: new Date(),
            });

            // Send unread count update
            const [unreadCount, unreadMsg] = await Promise.all([
                this.notificationService.getUnreadCount(userId),
                this.messageService.getUnreadMessageCount(userId)
            ]);

            this.server.to(`user:${userId}`).emit('unread-count-update', {
                count: unreadCount,
                unreadMsgCount: unreadMsg.data,
                timestamp: new Date(),
            });

            return true;
        } catch (error) {
            console.error('❌ Error sending realtime notification:', error);
            return false;
        }
    }

    public async sendNotificationToUser(
        userId: string,
        title: string,
        body: string,
        type: NotificationType,
        data?: any,
        options?: any
    ): Promise<boolean> {
        try {
            const isOnline = this.isUserOnline(userId);

            if (isOnline) {
                // Send real-time notification
                return await this.sendRealtimeNotification(userId, {
                    title,
                    body,
                    type,
                    data,
                    priority: options?.priority || 'normal',
                    actionUrl: options?.actionUrl,
                });
            } else {
                // Send push notification
                const notification = await this.notificationService.sendNotification({
                    recipient: userId,
                    title,
                    body,
                    type,
                    priority: options?.priority,
                    data,
                    actionUrl: options?.actionUrl,
                    sendPush: true,
                });

                return notification.success;
            }
        } catch (error) {
            console.error('❌ Error sending notification to user:', error);
            return false;
        }
    }

    public async broadcastNotification(
        userIds: string[],
        title: string,
        body: string,
        type: NotificationType,
        data?: any,
        options?: any
    ): Promise<void> {
        const onlineUsers: string[] = [];
        const offlineUsers: string[] = [];

        // Separate online and offline users
        userIds.forEach(userId => {
            if (this.isUserOnline(userId)) {
                onlineUsers.push(userId);
            } else {
                offlineUsers.push(userId);
            }
        });

        // Send real-time notifications to online users
        const onlinePromises = onlineUsers.map(userId =>
            this.sendRealtimeNotification(userId, {
                title,
                body,
                type,
                data,
                priority: options?.priority || 'normal',
                actionUrl: options?.actionUrl,
            })
        );

        await Promise.allSettled(onlinePromises);

        // Send push notifications to offline users
        if (offlineUsers.length > 0) {
            await this.notificationService.sendBulkNotifications(offlineUsers, {
                title,
                body,
                type,
                priority: options?.priority,
                data,
                actionUrl: options?.actionUrl,
                sendPush: true,
            }).catch(err => console.error('Error sending bulk notifications:', err));
        }
    }

    // ============ PREDEFINED NOTIFICATION METHODS ============

    public async sendBookingNotification(
        userId: string,
        bookingId: string,
        status: string,
        details?: any
    ): Promise<boolean> {
        const statusMessages: Record<string, string> = {
            confirmed: 'Your booking has been confirmed!',
            cancelled: 'Your booking has been cancelled.',
            completed: 'Your booking has been completed.',
            pending: 'Your booking is pending confirmation.',
        };

        return await this.sendNotificationToUser(
            userId,
            'Booking Update',
            statusMessages[status] || `Booking status: ${status}`,
            NotificationType.BOOKING,
            { bookingId, status, ...details },
            {
                actionUrl: `/bookings/${bookingId}`,
                priority: 'high'
            }
        );
    }

    public async sendOrderNotification(
        userId: string,
        orderId: string,
        status: string,
        details?: any
    ): Promise<boolean> {
        const statusMessages: Record<string, string> = {
            placed: 'Your order has been placed successfully!',
            confirmed: 'Your order has been confirmed.',
            processing: 'Your order is being processed.',
            shipped: 'Your order has been shipped.',
            delivered: 'Your order has been delivered.',
            cancelled: 'Your order has been cancelled.',
        };

        return await this.sendNotificationToUser(
            userId,
            'Order Update',
            statusMessages[status] || `Order status: ${status}`,
            NotificationType.ORDER,
            { orderId, status, ...details },
            {
                actionUrl: `/orders/${orderId}`,
                priority: 'high'
            }
        );
    }

    public async sendFriendRequestNotification(
        fromUserId: string,
        toUserId: string,
        fromUserName: string
    ): Promise<boolean> {
        return await this.sendNotificationToUser(
            toUserId,
            'New Friend Request',
            `${fromUserName} sent you a friend request`,
            NotificationType.FRIEND_REQUEST,
            { fromUserId, fromUserName },
            {
                actionUrl: `/friends/requests`,
                priority: 'normal'
            }
        );
    }

    public async sendFollowNotification(
        fromUserId: string,
        toUserId: string,
        fromUserName: string
    ): Promise<boolean> {
        return await this.sendNotificationToUser(
            toUserId,
            'New Follower',
            `${fromUserName} started following you`,
            NotificationType.FOLLOW,
            { fromUserId, fromUserName },
            {
                actionUrl: `/profile/${fromUserId}`,
                priority: 'normal'
            }
        );
    }

    public async sendPaymentNotification(
        userId: string,
        paymentId: string,
        amount: number,
        status: string
    ): Promise<boolean> {
        const statusMessages: Record<string, string> = {
            successful: `Payment of ${amount} was successful`,
            failed: `Payment of ${amount} failed`,
            pending: `Payment of ${amount} is pending`,
            refunded: `Refund of ${amount} has been processed`,
        };

        return await this.sendNotificationToUser(
            userId,
            'Payment Update',
            statusMessages[status] || `Payment status: ${status}`,
            NotificationType.PAYMENT,
            { paymentId, amount, status },
            {
                actionUrl: `/payments/${paymentId}`,
                priority: 'high'
            }
        );
    }
}