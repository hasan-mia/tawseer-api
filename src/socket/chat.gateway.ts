import { MessageService } from '@/message/message.service';
import { Conversation } from '@/schemas/conversation.schema';
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

    constructor(
        @InjectModel(Conversation.name)
        private conversationModel: Model<Conversation>,
        private messageService: MessageService,
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
            socket.data.userId = userId.toString();
            socket.data.authenticated = true;

            console.log(`User ${userId} authenticated with socket ${socket.id}`);

            // Broadcast user came online (debounced)
            this.debouncedStatusBroadcast(userId.toString(), true);

            socket.emit('connection_success', {
                message: 'Successfully connected',
                userId: userId.toString()
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

            // Save message to database
            const messageResult = await this.messageService.sendMessage({
                senderId,
                conversationId,
                content: content.trim(),
                attachments: attachments || []
            });

            if (!messageResult.success) {
                socket.emit('message-failure', {
                    success: false,
                    error: 'Failed to save message',
                    tempId: data.tempId
                });
                return;
            }

            console.log(`Message sent successfully in conversation ${conversationId}`);

            // Emit success to sender
            socket.emit('send-message', {
                success: true,
                message: messageResult.data,
                tempId: data.tempId
            });

            // socket.to(`conversation:${conversationId}`).emit('new-message', {
            //     message: messageResult.data,
            //     conversationId: conversationId,
            // });

            this.server.to(`conversation:${conversationId}`)
                .except(socket.id)
                .emit('new-message', {
                    message: messageResult.data,
                    conversationId,
                });

        } catch (error) {
            console.error('Error handling send message:', error);
            socket.emit('message-failure', {
                success: false,
                error: error.message,
                tempId: data.tempId
            });
        }
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

    // Helper methods
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
                unreadCount,
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
}