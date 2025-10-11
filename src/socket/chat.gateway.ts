import { MessageService } from '@/message/message.service';
import { NotificationService } from '@/notification/notification.service';
import { Conversation } from '@/schemas/conversation.schema';
import { NotificationType } from '@/schemas/notification.schema';
import { Injectable } from '@nestjs/common';
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

@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
})
@Injectable()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    public server: Server;

    // Enhanced user tracking
    private connectedUsers = new Map<string, ConnectedUser>();
    private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
    private typingUsers = new Map<string, Set<string>>();
    private statusBroadcastQueue = new Map<string, NodeJS.Timeout>();
    private processingMessages = new Set<string>();

    constructor(
        @InjectModel(Conversation.name)
        private conversationModel: Model<Conversation>,
        private messageService: MessageService,
        private notificationService: NotificationService,
        private jwtService: JwtService
    ) { }

    afterInit(server: Server) {
        console.log('Chat Socket.io Initialized');

        // Set up periodic cleanup of stale connections
        setInterval(() => {
            this.cleanupStaleConnections();
        }, 5 * 60 * 1000);
    }

    async handleConnection(socket: Socket) {
        try {
            console.log(`Client attempting connection: ${socket.id}`);

            const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.split(' ')[1] ||
                socket.handshake.query.token;

            if (!token) {
                console.log('No token provided, disconnecting socket', socket.id);
                socket.emit('auth_error', { message: 'No authentication token provided' });
                socket.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token);
            const userId = payload.sub || payload.id || payload._id;

            if (!userId) {
                throw new Error('Invalid user ID in token');
            }

            // Handle multiple connections for same user (different devices/tabs)
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            this.userSockets.get(userId).add(socket.id);

            // Store connection info
            this.connectedUsers.set(socket.id, {
                userId: userId.toString(),
                socketId: socket.id,
                joinedAt: new Date(),
                lastSeen: new Date()
            });

            // Join user to their personal room
            socket.join(`user:${userId}`);
            socket.join(`notifications:${userId}`);
            socket.data.userId = userId.toString();
            socket.data.authenticated = true;

            console.log(`User ${userId} authenticated with socket ${socket.id}`);

            // Broadcast user came online (debounced)
            this.debouncedStatusBroadcast(userId.toString(), true);

            // Send current unread notification count
            const unreadNotificationCount = await this.notificationService.getUnreadCount(userId.toString());
            const unreadMsg = await this.messageService.getUnreadMessageCount(userId);


            socket.emit('connection_success', {
                message: 'Successfully connected',
                userId: userId.toString(),
            });

            // Send unread count update
            socket.emit('unread-count-update', {
                count: unreadNotificationCount,
                unreadMsgCount: unreadMsg.data,
                timestamp: new Date(),
            });

        } catch (error) {
            console.error('Socket connection error:', error);
            socket.emit('auth_error', { message: 'Invalid authentication token' });
            socket.disconnect();
        }
    }

    handleDisconnect(socket: Socket) {
        console.log(`Client disconnected: ${socket.id}`);

        const connectedUser = this.connectedUsers.get(socket.id);
        if (connectedUser) {
            const userId = connectedUser.userId;

            // Remove from connected users
            this.connectedUsers.delete(socket.id);

            // Remove socket from user's socket set
            const userSocketSet = this.userSockets.get(userId);
            if (userSocketSet) {
                userSocketSet.delete(socket.id);

                // If no more sockets for this user, they're offline
                if (userSocketSet.size === 0) {
                    this.userSockets.delete(userId);

                    // Remove from typing and broadcast offline status
                    this.removeFromAllTyping(userId);
                    this.debouncedStatusBroadcast(userId, false);
                }
            }

            console.log(`User ${userId} disconnected. Remaining connections: ${userSocketSet?.size || 0}`);
        }
    }

    @SubscribeMessage('join-conversation')
    async handleJoinConversation(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        try {
            if (!socket.data.authenticated) {
                socket.emit('join-conversation', { success: false, error: 'Not authenticated' });
                return;
            }

            const { conversationId } = data;
            const userId = socket.data.userId;

            // Verify user is part of this conversation
            const conversation = await this.conversationModel.findById(conversationId);
            if (!conversation) {
                socket.emit('join-conversation', { success: false, error: 'Conversation not found' });
                return;
            }

            if (!conversation.participants.some(p => p.toString() === userId)) {
                socket.emit('join-conversation', { success: false, error: 'Not authorized to join this conversation' });
                return;
            }

            socket.join(`conversation:${conversationId}`);
            console.log(`Socket ${socket.id} (User ${userId}) joined conversation: ${conversationId}`);

            // Debug: Log all sockets in this room
            const room = this.server.sockets.adapter.rooms.get(`conversation:${conversationId}`);
            console.log(`Room conversation:${conversationId} now has ${room?.size} members`);


            this.updateUserLastSeen(socket.id);

            socket.emit('join-conversation', {
                conversationId,
                success: true,
                message: 'Successfully joined conversation'
            });

        } catch (error) {
            console.error('Error joining conversation:', error);
            socket.emit('join-conversation', { success: false, error: error.message });
        }
    }

    @SubscribeMessage('leave-conversation')
    handleLeaveConversation(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        try {
            const { conversationId } = data;
            const userId = socket.data.userId;

            socket.leave(`conversation:${conversationId}`);
            console.log(`Socket ${socket.id} (User ${userId}) left conversation: ${conversationId}`);

            // Remove from typing if they were typing
            this.removeFromTyping(conversationId, userId);

            return { event: 'leave-conversation', data: { conversationId, success: true } };
        } catch (error) {
            console.error('Error leaving conversation:', error);
            return { event: 'leave-conversation', data: { success: false, error: error.message } };
        }
    }

    @SubscribeMessage('get-messages')
    async handleGetMessages(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string; page?: number; limit?: number }
    ) {
        try {
            if (!socket.data.authenticated) {
                socket.emit('get-messages', { success: false, error: 'Not authenticated' });
                return;
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

            console.log(`Messages fetched for conversation ${data.conversationId}, page ${data.page ?? 1}`);

            // Emit response directly to the requesting socket
            socket.emit('get-messages', result);

        } catch (error) {
            console.error('Error fetching messages:', error);
            socket.emit('get-messages', { success: false, error: error.message });
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
            if (!socket.data.authenticated) {
                socket.emit('message-failure', {
                    success: false,
                    error: 'Not authenticated',
                    tempId: data.tempId
                });
                return;
            }

            const senderId = socket.data.userId;

            if (!data.conversationId || !data.content?.trim()) {
                socket.emit('message-failure', {
                    success: false,
                    error: 'Invalid message data',
                    tempId: data.tempId
                });
                return;
            }

            const { conversationId, content, attachments } = data;

            this.updateUserLastSeen(socket.id);
            this.removeFromTyping(conversationId, senderId);

            // duplicate prevention
            const messageKey = `${socket.id}-${data.tempId}`;
            if (this.processingMessages.has(messageKey)) {
                console.log('Ignoring duplicate from same socket with same tempId');
                return;
            }
            this.processingMessages.add(messageKey);

            try {
                // Save message to database
                const messageResult = await this.messageService.sendMessage({
                    senderId,
                    conversationId,
                    content: content.trim(),
                    attachments: attachments || []
                });

                if (messageResult.success && messageResult.data) {
                    console.log(`Message sent successfully in conversation ${conversationId}`);

                    // Emit success to sender
                    socket.emit('send-message', {
                        success: true,
                        message: messageResult.data,
                        tempId: data.tempId
                    });

                    this.server.to(`conversation:${conversationId}`)
                        .except(socket.id)
                        .emit('new-message', {
                            message: messageResult.data,
                            conversationId,
                        });


                    // Get conversation participants for notifications
                    const conversation = await this.conversationModel
                        .findById(conversationId)
                        .populate('participants', 'first_name last_name avatar fcmToken');

                    if (conversation) {
                        // Broadcast to other participants in the room
                        this.server.to(`conversation:${conversationId}`)
                            .except(socket.id)
                            .emit('new-message', {
                                message: messageResult.data,
                                conversationId,
                            });

                        // Handle notifications for other participants
                        const otherParticipants = conversation.participants.filter(
                            (participant: any) => participant._id.toString() !== senderId
                        );

                        for (const participant of otherParticipants) {
                            const participantId = participant._id.toString();

                            // Get unread count
                            const unreadNotificationCount = await this.notificationService.getUnreadCount(participantId);
                            const unreadData = await this.messageService.getUnreadMessageCount(participantId);

                            // Emit to user
                            this.server.to(`user:${participantId}`).emit('unread-count-update', {
                                count: unreadNotificationCount,
                                unreadMsgCount: unreadData.data,
                                timestamp: new Date(),
                            });

                            // Check if user is online
                            const isOnline = this.isUserOnline(participantId);

                            // Prepare notification content
                            const notificationTitle = messageResult.data.sender.first_name || 'New Message';
                            const notificationBody = content.length > 100 ?
                                content.substring(0, 100) + '...' : content;

                            if (!isOnline) {
                                // Send push notification for offline users
                                await this.notificationService.sendChatNotification(
                                    senderId,
                                    participantId,
                                    conversationId,
                                    notificationBody
                                );
                            }
                            // else {
                            //     // Send real-time notification for online users
                            //     await this.sendRealtimeNotification(participantId, {
                            //         type: 'chat',
                            //         title: notificationTitle,
                            //         body: notificationBody,
                            //         data: {
                            //             conversationId,
                            //             senderId,
                            //             messageId: messageResult.data._id,
                            //         },
                            //         actionUrl: `/message/${conversationId}`,
                            //         priority: 'high'
                            //     });
                            // }

                        }
                    }
                } else {
                    socket.emit('message-failure', {
                        success: false,
                        error: 'Failed to save message',
                        tempId: data.tempId
                    });
                }

            } finally {
                // Clean up duplicate prevention after 2 seconds
                setTimeout(() => {
                    this.processingMessages.delete(messageKey);
                }, 2000);
            }

        } catch (error) {
            if (error.message !== "Duplicate message prevented") {
                socket.emit('message-failure', {
                    success: false,
                    error: error.message || 'Internal server error',
                    tempId: data.tempId
                });
                console.error('Error handling send message:', error);
            }

        }
    }

    @SubscribeMessage('get-unread-count')
    async handleGetUnreadCount(@ConnectedSocket() socket: Socket) {
        if (!socket.data.authenticated) return;

        const userId = socket.data.userId;
        const unreadNotificationCount = await this.notificationService.getUnreadCount(userId.toString());
        const unreadMsg = await this.messageService.getUnreadMessageCount(userId);

        socket.emit('unread-count-update', {
            count: unreadNotificationCount,
            unreadMsgCount: unreadMsg.data,
            timestamp: new Date(),
        });
    }

    @SubscribeMessage('mark-read')
    async handleMarkRead(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { messageId: string }
    ) {
        try {
            if (!socket.data.authenticated) {
                return { event: 'mark-read', data: { success: false, error: 'Not authenticated' } };
            }

            const userId = socket.data.userId;
            const { messageId } = data;

            const result = await this.messageService.markMessageAsRead(
                messageId,
                userId,
            );

            // Update last seen
            this.updateUserLastSeen(socket.id);

            return { event: 'mark-read', data: result };
        } catch (error) {
            console.error('Error marking message as read:', error);
            return { event: 'mark-read', data: { success: false, error: error.message } };
        }
    }

    @SubscribeMessage('typing')
    handleTyping(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string; isTyping: boolean }
    ) {
        try {
            if (!socket.data.authenticated) {
                return { event: 'typing', data: { success: false, error: 'Not authenticated' } };
            }

            const { conversationId, isTyping } = data;
            const userId = socket.data.userId;

            // Update last seen
            this.updateUserLastSeen(socket.id);

            if (isTyping) {
                this.addToTyping(conversationId, userId);
            } else {
                this.removeFromTyping(conversationId, userId);
            }

            // Broadcast typing status to the conversation room except the sender
            socket.to(`conversation:${conversationId}`).emit('user-typing', {
                userId,
                conversationId,
                isTyping
            });

            return { event: 'typing', data: { success: true } };
        } catch (error) {
            console.error('Error handling typing:', error);
            return { event: 'typing', data: { success: false, error: error.message } };
        }
    }

    @SubscribeMessage('get-online-status')
    async handleGetOnlineStatus(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { userIds: string[]; conversationId?: string }
    ) {
        try {
            if (!socket.data.authenticated) {
                socket.emit('get-online-status', { success: false, error: 'Not authenticated' });
                return;
            }

            const { userIds, conversationId } = data;

            // Get online status for requested users
            const onlineStatus = userIds.reduce((acc, userId) => {
                acc[userId] = this.isUserOnline(userId);
                return acc;
            }, {} as Record<string, boolean>);

            // Get last seen info (you'd implement this with a database)
            const lastSeenInfo = await this.getLastSeenInfo(userIds);

            socket.emit('get-online-status', {
                success: true,
                status: onlineStatus,
                lastSeen: lastSeenInfo,
                timestamp: new Date()
            });

            // If conversation provided, also get conversation-specific presence
            if (conversationId) {
                const conversationPresence = await this.getConversationPresence(conversationId);
                socket.emit('conversation-presence', {
                    conversationId,
                    presence: conversationPresence,
                    timestamp: new Date()
                });
            }

        } catch (error) {
            console.error('Error getting online status:', error);
            socket.emit('get-online-status', { success: false, error: error.message });
        }
    }

    @SubscribeMessage('subscribe-user-status')
    async handleSubscribeUserStatus(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { userIds: string[] }
    ) {
        try {
            if (!socket.data.authenticated) {
                socket.emit('subscribe-user-status', { success: false, error: 'Not authenticated' });
                return;
            }

            const { userIds } = data;

            // Join rooms for status updates of specific users
            userIds.forEach(userId => {
                socket.join(`status-updates:${userId}`);
            });

            socket.emit('subscribe-user-status', {
                success: true,
                subscribedTo: userIds,
                message: 'Subscribed to user status updates'
            });

        } catch (error) {
            console.error('Error subscribing to user status:', error);
            socket.emit('subscribe-user-status', { success: false, error: error.message });
        }
    }

    // Heartbeat to update last seen
    @SubscribeMessage('heartbeat')
    handleHeartbeat(@ConnectedSocket() socket: Socket) {
        if (socket.data.authenticated) {
            this.updateUserLastSeen(socket.id);
            socket.emit('heartbeat-ack', { timestamp: new Date() });
        }
    }


    // ============ NOTIFICATION-SPECIFIC SOCKET EVENTS ============

    @SubscribeMessage('join-notifications')
    async handleJoinNotifications(@ConnectedSocket() socket: Socket) {
        if (!socket.data.authenticated) {
            socket.emit('join-notifications', { success: false, error: 'Not authenticated' });
            return;
        }

        const userId = socket.data.userId;
        socket.join(`notifications:${userId}`);

        // Send current unread count
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
        if (!socket.data.authenticated) {
            socket.emit('get-notifications', { success: false, error: 'Not authenticated' });
            return;
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
            socket.emit('get-notifications', {
                success: false,
                error: error.message
            });
        }
    }

    private updateUserLastSeen(socketId: string) {
        const user = this.connectedUsers.get(socketId);
        if (user) {
            user.lastSeen = new Date();
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

    private debouncedStatusBroadcast(userId: string, isOnline: boolean, delay: number = 1000) {
        // Clear existing timeout for this user
        const existingTimeout = this.statusBroadcastQueue.get(userId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
            this.broadcastUserStatus(userId, isOnline);
            this.statusBroadcastQueue.delete(userId);
        }, delay);

        this.statusBroadcastQueue.set(userId, timeout);
    }

    private broadcastUserStatus(userId: string, isOnline: boolean) {
        // Broadcast to subscribers of this user's status
        this.server.to(`status-updates:${userId}`).emit('user-status-change', {
            userId,
            isOnline,
            timestamp: new Date()
        });

        console.log(`Broadcasted status change: User ${userId} is ${isOnline ? 'online' : 'offline'}`);
    }

    private async getLastSeenInfo(userIds: string[]): Promise<Record<string, Date | null>> {
        // Implement this method to fetch last seen from database
        // For now, return current connected users' last seen or null
        const lastSeenInfo: Record<string, Date | null> = {};

        userIds.forEach(userId => {
            // Find any socket for this user
            const userSocketSet = this.userSockets.get(userId);
            if (userSocketSet && userSocketSet.size > 0) {
                // User is online, get their latest last seen
                const socketId = Array.from(userSocketSet)[0];
                const connectedUser = this.connectedUsers.get(socketId);
                lastSeenInfo[userId] = connectedUser?.lastSeen || null;
            } else {
                // User is offline, you'd fetch from database here
                lastSeenInfo[userId] = null; // Or fetch from DB
            }
        });

        return lastSeenInfo;
    }

    private async getConversationPresence(conversationId: string): Promise<Record<string, boolean>> {
        // Get all participants in the conversation
        const conversation = await this.conversationModel.findById(conversationId).populate('participants');
        if (!conversation) return {};

        const presence: Record<string, boolean> = {};
        conversation.participants.forEach((participant: any) => {
            const userId = participant._id.toString();
            presence[userId] = this.isUserOnline(userId);
        });

        return presence;
    }

    // Public method to notify users (can be called from other services)
    async notifyUserOfNewMessages(userId: string, unreadCount: number) {
        const userConnection = Array.from(this.connectedUsers.values())
            .find(user => user.userId === userId);

        if (userConnection) {
            this.server.to(`user:${userId}`).emit('unread-count-update', {
                count: unreadCount,
                timestamp: new Date()
            });
        }
    }

    // Get connected users count
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

    // Method to be called from other services
    public async notifyUserStatusChange(userId: string, isOnline: boolean) {
        this.broadcastUserStatus(userId, isOnline);
    }

    // Cleanup method
    private cleanupStaleConnections() {
        const now = new Date();
        const staleThreshold = 10 * 60 * 1000; // 10 minutes

        for (const [socketId, user] of this.connectedUsers.entries()) {
            if (now.getTime() - user.lastSeen.getTime() > staleThreshold) {
                console.log(`Cleaning up stale connection for user ${user.userId}, socket ${socketId}`);

                const socket = this.server.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect();
                }

                this.connectedUsers.delete(socketId);
                this.removeFromAllTyping(user.userId);
            }
        }
    }


    // ============ NOTIFICATION HELPER METHODS ============

    // Send real-time notification to online users
    public async sendRealtimeNotification(userId: string, notificationData: any): Promise<boolean> {
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet && userSocketSet.size > 0) {
            // Create notification in database first
            const notification = await this.notificationService.sendNotification({
                recipient: userId,
                title: notificationData.title,
                body: notificationData.body,
                type: notificationData.type,
                priority: notificationData.priority,
                data: notificationData.data,
                actionUrl: notificationData.actionUrl,
                sendPush: false, // Don't send push for online users
            });

            if (notification.success) {
                // Send to all user's connected sockets
                this.server.to(`user:${userId}`).emit('new-notification', {
                    notification: notification.data,
                    timestamp: new Date(),
                });

                // Also send unread count update
                const unreadCount = await this.notificationService.getUnreadCount(userId);
                const unreadMsg = await this.messageService.getUnreadMessageCount(userId);

                this.server.to(`user:${userId}`).emit('unread-count-update', {
                    count: unreadCount,
                    unreadMsgCount: unreadMsg.data,
                    timestamp: new Date(),
                });

                return true;
            }
        }
        return false;
    }

    // Send notification to user (will determine if push or real-time)
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
            console.error('Error sending notification to user:', error);
            return false;
        }
    }

    // Broadcast notification to multiple users
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
        for (const userId of onlineUsers) {
            await this.sendRealtimeNotification(userId, {
                title,
                body,
                type,
                data,
                priority: options?.priority || 'normal',
                actionUrl: options?.actionUrl,
            });
        }

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
            });
        }
    }

    // ============ PREDEFINED NOTIFICATION METHODS ============

    public async sendBookingNotification(userId: string, bookingId: string, status: string, details?: any): Promise<boolean> {
        const statusMessages = {
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

    public async sendOrderNotification(userId: string, orderId: string, status: string, details?: any): Promise<boolean> {
        const statusMessages = {
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

    public async sendFriendRequestNotification(fromUserId: string, toUserId: string, fromUserName: string): Promise<boolean> {
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

    public async sendFollowNotification(fromUserId: string, toUserId: string, fromUserName: string): Promise<boolean> {
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

    public async sendPaymentNotification(userId: string, paymentId: string, amount: number, status: string): Promise<boolean> {
        const statusMessages = {
            successful: `Payment of $${amount} was successful`,
            failed: `Payment of $${amount} failed`,
            pending: `Payment of $${amount} is pending`,
            refunded: `Refund of $${amount} has been processed`,
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