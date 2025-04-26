import { Conversation } from '@/schemas/conversation.schema';
import { Message } from '@/schemas/message.schema';
import { User } from '@/schemas/user.schema';
import { ChatGateway } from '@/socket/chat.gateway';
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMessageDto } from './dto/message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) { }

  async findOrCreateConversation(
    participantIds: Types.ObjectId[],
  ): Promise<Conversation> {
    // Sort the participant IDs to ensure consistent conversation lookup
    const sortedParticipantIds = [...participantIds].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    // Find existing conversation between these users
    let conversation = await this.conversationModel.findOne({
      participants: { $all: sortedParticipantIds },
      $expr: { $eq: [{ $size: '$participants' }, sortedParticipantIds.length] },
    });

    // If no conversation exists, create a new one
    if (!conversation) {
      conversation = await this.conversationModel.create({
        participants: sortedParticipantIds,
      });
    }

    return conversation;
  }

  async sendMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    const { senderId, receiverId, content, attachments } = createMessageDto;

    // Validate that both users exist
    const sender = await this.userModel.findById(senderId);
    const receiver = await this.userModel.findById(receiverId);

    if (!sender || !receiver) {
      throw new NotFoundException('Sender or receiver not found');
    }

    // Find or create a conversation between these users
    const conversation = await this.findOrCreateConversation([
      senderId, receiverId
    ]);

    // Create the new message
    const newMessage = await this.messageModel.create({
      sender: senderId,
      receiver: receiverId,
      content,
      attachments: attachments || [],
    });

    // Update the conversation with the last message
    await this.conversationModel.findByIdAndUpdate(
      conversation._id,
      { last_message: newMessage._id },
    );

    // Populate the new message with sender and receiver details for socket emission
    const populatedMessage = await this.messageModel.findById(newMessage._id)
      .populate('sender', 'uuid first_name last_name avatar')
      .populate('receiver', 'uuid first_name last_name avatar');

    return populatedMessage;
  }

  async getConversations(userId: Types.ObjectId): Promise<any[]> {
    // Find all conversations that include this user
    const conversations = await this.conversationModel
      .find({ participants: userId, is_deleted: false })
      .populate({
        path: 'last_message',
        populate: [
          { path: 'sender', select: 'uuid first_name last_name avatar' },
          { path: 'receiver', select: 'uuid first_name last_name avatar' }
        ]
      })
      .populate('participants', 'uuid first_name last_name avatar')
      .sort({ updatedAt: -1 });

    // Get unread message counts for each conversation
    const conversationsWithCounts = await Promise.all(conversations.map(async (conv) => {
      const unreadCount = await this.messageModel.countDocuments({
        sender: { $in: conv.participants },
        receiver: userId,
        is_read: false,
        is_deleted: false
      });

      const otherParticipants = conv.participants.filter(
        participant => participant._id.toString() !== userId.toString()
      );

      return {
        ...conv.toObject(),
        other_participants: otherParticipants,
        unread_count: unreadCount
      };
    }));

    return conversationsWithCounts;
  }

  async getMessagesByConversation(
    conversationId: string,
    userId: Types.ObjectId,
    page = 1,
    limit = 20,
  ): Promise<{ messages: Message[]; total: number; pages: number }> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Ensure user is part of this conversation
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      throw new NotFoundException('User not part of this conversation');
    }

    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      this.messageModel
        .find({
          $or: [
            { sender: { $in: conversation.participants }, receiver: { $in: conversation.participants } }
          ],
          is_deleted: false,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'uuid first_name last_name avatar')
        .populate('receiver', 'uuid first_name last_name avatar'),
      this.messageModel.countDocuments({
        $or: [
          { sender: { $in: conversation.participants }, receiver: { $in: conversation.participants } }
        ],
        is_deleted: false,
      }),
    ]);

    // Mark unread messages as read if the current user is the receiver
    const unreadMessages = await this.messageModel.find({
      conversation: conversationId,
      receiver: userId,
      is_read: false,
    });

    if (unreadMessages.length > 0) {
      await this.messageModel.updateMany(
        {
          _id: { $in: unreadMessages.map(m => m._id) }
        },
        {
          $set: { is_read: true, read_at: new Date() }
        }
      );
    }

    return {
      messages: messages.reverse(),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async markMessageAsRead(messageId: string): Promise<Message> {
    const message = await this.messageModel.findByIdAndUpdate(
      messageId,
      { is_read: true, read_at: new Date() },
      { new: true },
    ).populate('sender', 'uuid first_name last_name avatar')
      .populate('receiver', 'uuid first_name last_name avatar');

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only allow deletion if the user is the sender
    if (message.sender.toString() !== userId) {
      throw new NotFoundException('Unauthorized to delete this message');
    }

    await this.messageModel.findByIdAndUpdate(messageId, { is_deleted: true });

    // Find the conversation this message belongs to
    const conversation = await this.conversationModel.findOne({
      participants: { $all: [message.sender, message.receiver] }
    });

    if (conversation) {
      // Notify conversation participants about the deleted message
      this.chatGateway.server.to(`conversation:${conversation._id}`).emit('message-deleted', {
        messageId,
        conversationId: conversation._id
      });
    }

    return true;
  }

  async getUnreadMessageCount(userId: Types.ObjectId): Promise<number> {
    return this.messageModel.countDocuments({
      receiver: userId,
      is_read: false,
      is_deleted: false
    });
  }
}