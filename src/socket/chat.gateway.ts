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

    // Keep track of connected users with more detailed info
    private connectedUsers = new Map<string, ConnectedUser>();

    // Track users currently typing in conversations
    private typingUsers = new Map<string, Set<string>>();

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

            // Extract token from various possible locations
            const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.split(' ')[1] ||
                socket.handshake.query.token;

            if (!token) {
                console.log('No token provided, disconnecting socket', socket.id);
                socket.emit('auth_error', { message: 'No authentication token provided' });
                socket.disconnect();
                return;
            }

            try {
                // Verify the token
                const payload = this.jwtService.verify(token);
                const userId = payload.sub || payload.id || payload._id;

                if (!userId) {
                    throw new Error('Invalid user ID in token');
                }

                // Remove any existing connection for this user
                const existingUser = Array.from(this.connectedUsers.entries())
                    .find(([_, user]) => user.userId === userId);

                if (existingUser) {
                    const [oldSocketId] = existingUser;
                    this.connectedUsers.delete(oldSocketId);

                    // Disconnect the old socket if it still exists
                    const oldSocket = this.server.sockets.sockets.get(oldSocketId);
                    if (oldSocket) {
                        oldSocket.disconnect();
                    }
                }

                // Store the new user connection
                this.connectedUsers.set(socket.id, {
                    userId: userId.toString(),
                    socketId: socket.id,
                    joinedAt: new Date(),
                    lastSeen: new Date()
                });

                // Join user to their personal room for targeted messages
                socket.join(`user:${userId}`);

                // Store userId in socket data for easy access
                socket.data.userId = userId.toString();
                socket.data.authenticated = true;

                console.log(`User ${userId} authenticated and connected with socket ${socket.id}`);

                // Emit connection success
                socket.emit('connection_success', {
                    message: 'Successfully connected',
                    userId: userId.toString()
                });

            } catch (jwtError) {
                console.log(`Invalid token, disconnecting socket: ${socket.id}`, jwtError.message);
                socket.emit('auth_error', { message: 'Invalid authentication token' });
                socket.disconnect();
            }
        } catch (error) {
            console.error('Socket connection error:', error);
            socket.emit('connection_error', { message: 'Connection failed' });
            socket.disconnect();
        }
    }

    handleDisconnect(socket: Socket) {
        console.log(`Client disconnected: ${socket.id}`);

        // Remove user from connected users map
        const connectedUser = this.connectedUsers.get(socket.id);
        if (connectedUser) {
            this.connectedUsers.delete(socket.id);
            console.log(`User ${connectedUser.userId} disconnected`);

            // Remove from all typing indicators
            this.removeFromAllTyping(connectedUser.userId);

            // Emit user offline status to their conversations
            this.broadcastUserStatus(connectedUser.userId, false);
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
    handleGetOnlineStatus(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { userIds: string[] }
    ) {
        try {
            if (!socket.data.authenticated) {
                return { event: 'get-online-status', data: { success: false, error: 'Not authenticated' } };
            }

            const onlineStatus = data.userIds.reduce((acc, userId) => {
                const isOnline = Array.from(this.connectedUsers.values())
                    .some(user => user.userId === userId);
                acc[userId] = isOnline;
                return acc;
            }, {} as Record<string, boolean>);

            return { event: 'get-online-status', data: { success: true, status: onlineStatus } };
        } catch (error) {
            console.error('Error getting online status:', error);
            return { event: 'get-online-status', data: { success: false, error: error.message } };
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

    private broadcastUserStatus(userId: string, isOnline: boolean) {
        // Broadcast to all users who might be interested
        // You might want to implement a more sophisticated system here
        this.server.emit('user-status-change', {
            userId,
            isOnline,
            timestamp: new Date()
        });
    }

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
    getConnectedUsersCount(): number {
        return this.connectedUsers.size;
    }

    // Check if user is online
    isUserOnline(userId: string): boolean {
        return Array.from(this.connectedUsers.values())
            .some(user => user.userId === userId);
    }
}