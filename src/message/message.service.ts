import { Conversation } from '@/schemas/conversation.schema';
import { Message } from '@/schemas/message.schema';
import { User } from '@/schemas/user.schema';
import { ChatGateway } from '@/socket/chat.gateway';
import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
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

  async findOrCreateConversation(participantIds: Types.ObjectId[]) {
    const sortedIds = [...participantIds].sort((a, b) =>
      a.toString().localeCompare(b.toString()),
    );

    let conversation = await this.conversationModel.findOne({
      participants: { $all: sortedIds },
      $expr: { $eq: [{ $size: '$participants' }, sortedIds.length] },
    });

    if (!conversation) {
      conversation = await this.conversationModel.create({
        participants: sortedIds,
      });
    }
    return {
      success: true,
      message: "Start conversation successfully",
      data: conversation
    };
  }

  async sendMessage(createMessageDto: CreateMessageDto) {
    const { senderId, conversationId, content, attachments } = createMessageDto;
    const sender = await this.userModel.findById(senderId);
    if (!sender) throw new NotFoundException('Sender not found');

    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const newMessage = await this.messageModel.create({
      conversation: conversationId,
      sender: senderId,
      content,
      attachments: attachments || [],
    });

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      last_message: newMessage._id,
      updatedAt: new Date(),
    });

    const populatedMessage = await this.messageModel
      .findById(newMessage._id)
      .populate('sender', 'first_name last_name avatar email')

    // Emit to socket room
    this.chatGateway.server
      .to(`conversation:${conversation._id}`)
      .emit('new-message', populatedMessage);

    return {
      success: true,
      message: "Message send successfully",
      data: populatedMessage
    };
  }

  async getConversations(userId: Types.ObjectId): Promise<any[]> {
    const conversations = await this.conversationModel
      .find({ participants: userId, is_deleted: false })
      .populate({
        path: 'last_message',
        populate: [
          { path: 'sender', select: 'first_name last_name avatar email' },
        ],
      })
      .populate('participants', 'first_name last_name avatar email')
      .sort({ updatedAt: -1 });

    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.messageModel.countDocuments({
          conversation: conv._id,
          is_read: false,
          is_deleted: false,
        });

        const otherParticipants = conv.participants.filter(
          (p) => p._id.toString() !== userId.toString(),
        );

        return {
          ...conv.toObject(),
          other_participants: otherParticipants,
          unread_count: unreadCount,
        };
      }),
    );

    return conversationsWithCounts;
  }

  async getMessagesByConversation(
    conversationId: string,
    userId: Types.ObjectId,
    page = 1,
    limit = 20,
  ) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (!conversation.participants.some((p) => p.toString() === userId.toString())) {
      throw new NotFoundException('User not part of this conversation');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ conversation: conversationId, is_deleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'first_name last_name avatar email'),
      this.messageModel.countDocuments({
        conversation: conversationId,
        is_deleted: false,
      }),
    ]);

    await this.messageModel.updateMany(
      { conversation: conversationId, receiver: userId, is_read: false },
      { $set: { is_read: true, read_at: new Date() } },
    );
    return {
      success: true,
      message: "Message fetched successfully",
      data: messages.reverse(),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async markMessageAsRead(messageId: string) {
    const message = await this.messageModel
      .findByIdAndUpdate(
        messageId,
        { is_read: true, read_at: new Date() },
        { new: true },
      )
      .populate('sender', 'first_name last_name avatar email')

    if (!message) throw new NotFoundException('Message not found');

    return {
      success: true,
      message: "Message read successfully",
      data: message
    };
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    if (message.sender.toString() !== userId.toString()) {
      throw new NotFoundException('Unauthorized to delete this message');
    }

    await this.messageModel.findByIdAndUpdate(messageId, { is_deleted: true });

    const conversation = await this.conversationModel.findById(message.conversation);
    if (conversation) {
      this.chatGateway.server
        .to(`conversation:${conversation._id}`)
        .emit('message-deleted', { messageId, conversationId: conversation._id });
    }

    return {
      success: true,
      message: "Message deleted successfully",
      data: true
    };
  }

  async getUnreadMessageCount(userId: string) {
    // Find conversations where the user is a participant
    const conversations = await this.conversationModel
      .find({ participants: userId })
      .select('_id');

    const conversationIds = conversations.map((c) => c._id);

    const data = await this.messageModel.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: userId },
      is_read: false,
      is_deleted: false,
    });

    return {
      success: true,
      message: "Unread found successfully",
      data: data
    }
  }

}
