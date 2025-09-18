import { Conversation } from '@/schemas/conversation.schema';
import { Message } from '@/schemas/message.schema';
import { User } from '@/schemas/user.schema';
import { ChatGateway } from '@/socket/chat.gateway';
import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
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
  };

  async sendMessage(createMessageDto: CreateMessageDto) {
    try {
      const { senderId, conversationId, content, attachments } = createMessageDto;

      // Verify sender exists
      const sender = await this.userModel.findById(senderId);
      if (!sender) {
        throw new NotFoundException('Sender not found');
      }

      // Verify conversation exists and sender is participant
      const conversation = await this.conversationModel.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!conversation.participants.some(p => p.toString() === senderId.toString())) {
        throw new NotFoundException('Sender is not a participant in this conversation');
      }

      // Create new message
      const newMessage = await this.messageModel.create({
        conversation: conversationId,
        sender: senderId,
        content: content.trim(),
        attachments: attachments || [],
        is_read: false,
        is_deleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Update conversation's last message and timestamp
      await this.conversationModel.findByIdAndUpdate(
        conversationId,
        {
          last_message: newMessage._id,
          updatedAt: new Date(),
        },
        { new: true }
      );

      // Populate the message with sender info
      const populatedMessage = await this.messageModel
        .findById(newMessage._id)
        .populate('sender', 'first_name last_name avatar email _id')
        .lean();

      // Emit to all participants in the conversation room
      if (this.chatGateway && this.chatGateway.server) {
        this.chatGateway.server
          .to(`conversation:${conversationId}`)
          .emit('new-message', {
            message: populatedMessage,
            conversationId: conversationId.toString()
          });

        // Also send notification to users not currently in the conversation room
        const otherParticipants = conversation.participants.filter(
          p => p.toString() !== senderId.toString()
        );

        otherParticipants.forEach(participantId => {
          this.chatGateway.server
            .to(`user:${participantId}`)
            .emit('message-notification', {
              message: populatedMessage,
              conversationId: conversationId.toString()
            });
        });
      }

      return {
        success: true,
        message: "Message sent successfully",
        data: populatedMessage
      };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async getConversations(userId: Types.ObjectId, req: any) {
    try {
      const page = req?.query?.page ? parseInt(req.query.page, 10) : 1;
      const limit = req?.query?.limit ? parseInt(req.query.limit, 10) : 10;
      const keyword = req?.query?.keyword || null;

      const skip = (page - 1) * limit;

      let baseQuery: any = { participants: userId, is_deleted: false };

      if (keyword) {
        baseQuery.$or = [
          { "sender.first_name": { $regex: keyword, $options: "i" } },
          { "sender.last_name": { $regex: keyword, $options: "i" } },
          { "sender.email": { $regex: keyword, $options: "i" } },
        ];
      }

      // Count total conversations
      const count = await this.conversationModel.countDocuments(baseQuery);

      // Fetch conversations with pagination
      const conversations = await this.conversationModel
        .find(baseQuery)
        .populate({
          path: "last_message",
          populate: [
            { path: "sender", select: "first_name last_name avatar email" },
          ],
        })
        .populate("participants", "first_name last_name avatar email")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      // Add unread counts & other participants
      const conversationsWithCounts = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await this.messageModel.countDocuments({
            conversation: conv._id,
            is_read: false,
            is_deleted: false,
          });

          const otherParticipants = conv.participants.filter(
            (p) => p._id.toString() !== userId.toString()
          );

          return {
            ...conv.toObject(),
            other_participants: otherParticipants,
            unread_count: unreadCount,
          };
        })
      );

      // Pagination info
      const totalPages = Math.ceil(count / limit);
      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (page < totalPages) {
        nextPage = page + 1;
        if (req) {
          const params = new URLSearchParams(req.query);
          params.set("page", nextPage.toString());
          nextUrl = `${req.originalUrl.split("?")[0]}?${params.toString()}`;
        }
      }

      return {
        success: true,
        message: "Conversations fetched successfully",
        data: conversationsWithCounts,
        total: count,
        perPage: limit,
        currentPage: page,
        totalPages,
        nextPage,
        nextUrl,
      };
    } catch (error) {
      console.error("Error in getConversations:", error);
      throw new InternalServerErrorException(error.message);
    }
  }


  async getMessagesByConversation(conversationId: string, userId: Types.ObjectId, req: any) {
    try {
      const page = req?.query?.page ? parseInt(req.query.page, 10) : 1;
      const limit = req?.query?.limit ? parseInt(req.query.limit, 10) : 20;

      const currentPage = page > 0 ? page : 1;
      const perPage = limit > 0 ? limit : 20;

      // Verify conversation exists and user is participant
      const conversation = await this.conversationModel.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException("Conversation not found");
      }

      if (!conversation.participants.some((p) => p.toString() === userId.toString())) {
        throw new NotFoundException("User not part of this conversation");
      }

      const skip = (currentPage - 1) * perPage;

      // Get messages with proper pagination
      const [messages, total] = await Promise.all([
        this.messageModel
          .find({
            conversation: conversationId,
            is_deleted: false
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage)
          .populate("sender", "first_name last_name avatar email _id")
          .lean(),
        this.messageModel.countDocuments({
          conversation: conversationId,
          is_deleted: false,
        }),
      ]);

      // Mark unread messages as read for this user
      await this.messageModel.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          is_read: false
        },
        {
          $set: {
            is_read: true,
            read_at: new Date()
          }
        }
      );

      // Calculate pagination info
      const totalPages = Math.ceil(total / perPage);
      let nextPage: number | null = null;
      let prevPage: number | null = null;
      let nextUrl: string | null = null;
      let prevUrl: string | null = null;

      if (currentPage < totalPages) {
        nextPage = currentPage + 1;
        if (req) {
          const params = new URLSearchParams(req.query);
          params.set("page", nextPage.toString());
          nextUrl = `${req.originalUrl.split("?")[0]}?${params.toString()}`;
        }
      }

      if (currentPage > 1) {
        prevPage = currentPage - 1;
        if (req) {
          const params = new URLSearchParams(req.query);
          params.set("page", prevPage.toString());
          prevUrl = `${req.originalUrl.split("?")[0]}?${params.toString()}`;
        }
      }

      // Reverse messages to show oldest first in the response
      const orderedMessages = messages.reverse();

      return {
        success: true,
        message: "Messages fetched successfully",
        data: orderedMessages,
        pagination: {
          total,
          perPage,
          currentPage,
          totalPages,
          hasNext: nextPage !== null,
          hasPrev: prevPage !== null,
          nextPage,
          prevPage,
          nextUrl,
          prevUrl,
        },
        // Keep these for backward compatibility
        total,
        perPage,
        currentPage,
        totalPages,
        nextPage,
        nextUrl,
      };
    } catch (error) {
      console.error('Error in getMessagesByConversation:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async markMessageAsRead(messageId: string, userId: Types.ObjectId) {
    try {
      const message = await this.messageModel.findById(messageId);
      if (!message) {
        throw new NotFoundException('Message not found');
      }

      // Only mark as read if it's not already read and user is not the sender
      if (!message.is_read && (!userId || message.sender.toString() !== userId.toString())) {
        const updatedMessage = await this.messageModel.findByIdAndUpdate(
          messageId,
          {
            is_read: true,
            read_at: new Date()
          },
          { new: true }
        ).populate('sender', 'first_name last_name avatar email _id');

        // Notify sender about read receipt
        if (this.chatGateway && this.chatGateway.server) {
          this.chatGateway.server
            .to(`user:${message.sender}`)
            .emit('message-read', {
              messageId,
              readAt: updatedMessage.read_at
            });
        }

        return {
          success: true,
          message: "Message marked as read",
          data: updatedMessage
        };
      }

      return {
        success: true,
        message: "Message already read or is own message",
        data: message
      };
    } catch (error) {
      console.error('Error in markMessageAsRead:', error);
      throw new InternalServerErrorException(error.message);
    }
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
