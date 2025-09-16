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
import { Model, Types } from 'mongoose';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    public server: Server;

    // Keep track of connected users and their socket IDs
    private connectedUsers = new Map<string, string>();

    constructor(
        @InjectModel(Conversation.name)
        private conversationModel: Model<Conversation>,
        private messageService: MessageService,
        private jwtService: JwtService
    ) { }

    afterInit(server: Server) {
        console.log('Chat Socket.io Initialized');
    }

    async handleConnection(socket: Socket) {
        try {
            console.log(`Client connected: ${socket.id}`);
            // Extract token from the handshake query or headers
            const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                socket.emit('auth_error', { message: 'No authentication token provided' });
                socket.disconnect();
                console.log('No token provided, disconnecting socket', socket.id);
                return;
            }

            try {
                // Verify the token
                const payload = this.jwtService.verify(token);
                const userId = payload.sub || payload.id;

                // Store the user connection
                this.connectedUsers.set(userId, socket.id);

                // Join user to their own room for targeted messages
                socket.join(`user:${userId}`);

                console.log(`User ${userId} authenticated and connected`);
            } catch (jwtError) {
                socket.emit('auth_error', { message: 'Invalid authentication token' });
                socket.disconnect();
                console.log(`Invalid token, disconnecting socket: ${socket.id}`);
            }
        } catch (error) {
            console.error('Socket connection error:', error);
            socket.disconnect();
        }
    }
    handleDisconnect(socket: Socket) {
        console.log(`Client disconnected: ${socket.id}`);

        // Remove user from connected users map
        for (const [userId, socketId] of this.connectedUsers.entries()) {
            if (socketId === socket.id) {
                this.connectedUsers.delete(userId);
                console.log(`User ${userId} disconnected`);
                break;
            }
        }
    }

    @SubscribeMessage('join-conversation')
    handleJoinConversation(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        const { conversationId } = data;
        socket.join(`conversation:${conversationId}`);
        console.log(`Socket ${socket.id} joined conversation: ${conversationId}`);
        return { event: 'join-conversation', data: { conversationId, success: true } };
    }

    @SubscribeMessage('leave-conversation')
    handleLeaveConversation(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string }
    ) {
        const { conversationId } = data;
        socket.leave(`conversation:${conversationId}`);
        console.log(`Socket ${socket.id} left conversation: ${conversationId}`);
        return { event: 'leave-conversation', data: { conversationId, success: true } };
    }

    @SubscribeMessage('send-message')
    async handleSendMessage(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: {
            conversationId: string,
            content: string,
            attachments?: string[]
        }
    ) {
        try {
            console.log(data)
            // Extract token from the handshake to get the sender ID
            const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.split(' ')[1];
            const payload = this.jwtService.verify(token);
            const senderId = payload.sub || payload.id || payload._id;

            console.log("Handle send message from", senderId, "data:", data);
            if (!senderId) {
                return { event: 'send-message', data: { success: false, error: 'Invalid sender' } };
            }

            // Validate input
            if (!data.conversationId || (!data.content)) {
                return { event: 'send-message', data: { success: false, error: 'Invalid message data' } };
            }

            const { conversationId, content, attachments } = data;

            // Save message to database
            const message = await this.messageService.sendMessage({
                senderId: new Types.ObjectId(senderId),
                conversationId: new Types.ObjectId(conversationId),
                content,
                attachments
            });

            // Get the conversation to find other participants
            const conversation = await this.conversationModel.findById(conversationId).populate('participants', '_id');

            if (!conversation) {
                return { event: 'send-message', data: { success: false, error: 'Conversation not found' } };
            }

            // Emit to the conversation room
            this.server.to(`conversation:${conversationId}`).emit('new-message', {
                message: message.data,
                conversationId
            });

            // Find receiver(s) - all participants except sender
            const receiverIds = conversation.participants
                .filter(participant => participant._id.toString() !== senderId.toString())
                .map(participant => participant._id.toString());

            // Send notification to receivers who are not in the conversation room
            receiverIds.forEach(receiverId => {
                const receiverSocketId = this.connectedUsers.get(receiverId);
                if (receiverSocketId) {
                    // Check if receiver is not already in the conversation room
                    const receiverSocket = this.server.sockets.sockets.get(receiverSocketId);
                    if (receiverSocket && !receiverSocket.rooms.has(`conversation:${conversationId}`)) {
                        this.server.to(`user:${receiverId}`).emit('message-notification', {
                            message: message.data,
                            conversationId
                        });
                    }
                }
            });

            return { event: 'send-message', data: { success: true, message: message.data } };
        } catch (error) {
            console.error('Error handling send message:', error);
            return { event: 'send-message', data: { success: false, error: error.message } };
        }
    }

    @SubscribeMessage('mark-read')
    async handleMarkRead(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { messageId: string }
    ) {
        try {
            const { messageId } = data;
            const updatedMessage = await this.messageService.markMessageAsRead(messageId);

            // Notify sender that their message has been read
            const senderSocketId = this.connectedUsers.get(updatedMessage.data.sender.toString());
            if (senderSocketId) {
                this.server.to(`user:${updatedMessage.data.sender}`).emit('message-read', {
                    messageId,
                    readAt: updatedMessage.data.read_at
                });
            }

            return { event: 'mark-read', data: { success: true, message: updatedMessage } };
        } catch (error) {
            console.error('Error marking message as read:', error);
            return { event: 'mark-read', data: { success: false, error: error.message } };
        }
    }

    @SubscribeMessage('typing')
    handleTyping(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { conversationId: string, isTyping: boolean }
    ) {
        const { conversationId, isTyping } = data;

        // Extract user info from token
        const token = socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1];
        const payload = this.jwtService.verify(token);
        const userId = payload.sub || payload._id;

        // Broadcast typing status to the conversation room except the sender
        socket.to(`conversation:${conversationId}`).emit('user-typing', {
            userId,
            conversationId,
            isTyping
        });

        return { event: 'typing', data: { success: true } };
    }

    // Method to notify a user when they receive a new message while offline
    async notifyUserOfNewMessages(userId: string, unreadCount: number) {
        const userSocketId = this.connectedUsers.get(userId);
        if (userSocketId) {
            this.server.to(`user:${userId}`).emit('unread-count-update', { unreadCount });
        }
    }
}