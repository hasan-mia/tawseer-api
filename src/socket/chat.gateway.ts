import { MessageService } from '@/message/message.service';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/chat'
})
@Injectable()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    public server: Server;

    // Keep track of connected users and their socket IDs
    private connectedUsers = new Map<string, string>();

    constructor(
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
                socket.disconnect();
                return;
            }

            // Verify the token
            const payload = this.jwtService.verify(token);
            const userId = payload.sub || payload._id;

            // Store the user connection
            this.connectedUsers.set(userId, socket.id);

            // Join user to their own room for targeted messages
            socket.join(`user:${userId}`);

            console.log(`User ${userId} authenticated and connected`);
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
            receiverId: string,
            content: string,
            attachments?: string[]
        }
    ) {
        try {
            // Extract token from the handshake to get the sender ID
            const token = socket.handshake.auth.token ||
                socket.handshake.headers.authorization?.split(' ')[1];
            const payload = this.jwtService.verify(token);
            const senderId = payload.sub || payload._id;

            const { receiverId, content, attachments } = data;

            // Save message to database
            const message = await this.messageService.sendMessage({
                senderId: new Types.ObjectId(senderId),
                receiverId: new Types.ObjectId(receiverId),
                content,
                attachments
            });

            // Get conversation to which this message belongs
            const conversation = await this.messageService.findOrCreateConversation([
                new Types.ObjectId(senderId),
                new Types.ObjectId(receiverId)
            ]);

            const conversationId = conversation._id.toString();

            // Emit to the conversation room
            this.server.to(`conversation:${conversationId}`).emit('new-message', {
                message,
                conversationId
            });

            // If the receiver is not in the conversation room, send a notification to their personal room
            const receiverSocketId = this.connectedUsers.get(receiverId);
            if (receiverSocketId) {
                this.server.to(`user:${receiverId}`).emit('message-notification', {
                    message,
                    conversationId
                });
            }

            return { event: 'send-message', data: { success: true, message } };
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
            const senderSocketId = this.connectedUsers.get(updatedMessage.sender.toString());
            if (senderSocketId) {
                this.server.to(`user:${updatedMessage.sender}`).emit('message-read', {
                    messageId,
                    readAt: updatedMessage.read_at
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