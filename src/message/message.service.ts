import { Conversation } from '@/schemas/conversation.schema';
import { Message } from '@/schemas/message.schema';
import { User } from '@/schemas/user.schema';
import { Vendor } from '@/schemas/vendor.schema';
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
    @InjectModel(Vendor.name) private readonly vendorModel: Model<Vendor>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) { }

  async findOrCreateConversation(participantIds: Types.ObjectId[], userId: Types.ObjectId) {
    const sortedIds = [...participantIds].sort((a, b) =>
      a.toString().localeCompare(b.toString()),
    );

    let conversation = await this.conversationModel.findOne({
      participants: { $all: sortedIds },
      $expr: { $eq: [{ $size: "$participants" }, sortedIds.length] },
    });

    if (!conversation) {
      conversation = await this.conversationModel.create({
        participants: sortedIds,
      });
    }

    // Populate similar to getConversations
    conversation = await this.conversationModel
      .findById(conversation._id)
      .populate({
        path: "last_message",
        populate: [{ path: "sender", select: "first_name last_name avatar email _id" }],
      })
      .populate("participants", "first_name last_name avatar email _id")
      .exec();

    // Count unread messages for this user
    const unreadCount = await this.messageModel.countDocuments({
      conversation: conversation._id.toString(),
      sender: { $ne: userId.toString() },
      is_read: false,
      is_deleted: false,
    });

    // Map participants (replace with vendor data if needed)
    const participants = await Promise.all(
      conversation.participants.map(async (p: any) => {
        const vendor = await this.vendorModel.findOne({ user: p._id.toString() }).lean();
        if (vendor) {
          return {
            _id: p._id,
            first_name: vendor.name,
            last_name: "",
            avatar: vendor.logo,
            email: p.email,
          };
        }
        return p;
      })
    );

    const ids = participants.map(p => String(p._id));
    if (!ids.includes(String(userId))) {
      throw new NotFoundException("Conversation not found");
    }

    const otherParticipants = participants.filter(
      (p) => String(p._id) !== String(userId)
    );

    return {
      success: true,
      message: "Conversation ready",
      data: {
        ...conversation.toObject(),
        last_message: conversation.last_message || null,
        participants,
        other_participants: otherParticipants,
        unread_count: unreadCount,
      },
    };
  }

  private recentMessages = new Map<string, number>();

  async sendMessage(createMessageDto: CreateMessageDto) {
    try {
      const { senderId, conversationId, content, attachments } = createMessageDto;

      // PREVENT DUPLICATE MESSAGE CREATION
      const messageKey = `${senderId}-${conversationId}-${content.trim()}`;
      const now = Date.now();
      const lastSent = this.recentMessages.get(messageKey);

      // If same message was sent within last 2 seconds, prevent duplicate
      if (lastSent && (now - lastSent) < 2000) {
        throw new InternalServerErrorException('Duplicate message prevented');
      }

      this.recentMessages.set(messageKey, now);

      // Clean up old entries to prevent memory leaks
      if (this.recentMessages.size > 1000) {
        const entries = Array.from(this.recentMessages.entries());
        entries.slice(0, 500).forEach(([key]) => {
          this.recentMessages.delete(key);
        });
      }

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

      // Create new message with additional duplicate prevention at DB level
      const newMessage = await this.messageModel.create({
        conversation: conversationId,
        sender: senderId,
        content: content.trim(),
        attachments: attachments || [],
        is_read: false,
        is_deleted: false,
        // Add a unique identifier to prevent DB duplicates
        messageHash: `${senderId}-${conversationId}-${Date.now()}-${Math.random()}`
      });

      // Update conversation's last message and timestamp
      await this.conversationModel.findByIdAndUpdate(
        conversationId,
        {
          last_message: newMessage._id,
          updatedAt: new Date()
        },
        { new: true }
      );

      // Fetch sender info separately
      const senderInfo = await this.userModel
        .findById(senderId)
        .select('first_name last_name avatar email _id')
        .lean();

      // Check if sender is a vendor
      const vendor = await this.vendorModel.findOne({ user: senderId.toString() }).lean();

      const displaySender = vendor ? {
        _id: senderInfo._id.toString(),
        first_name: vendor.name,
        last_name: "",
        avatar: vendor.logo,
        email: senderInfo.email,
      } : {
        _id: senderInfo._id.toString(),
        first_name: senderInfo.first_name,
        last_name: senderInfo.last_name,
        avatar: senderInfo.avatar,
        email: senderInfo.email,
      };

      // Use type assertion to access timestamp properties
      const messageDoc = newMessage as any;

      // Create response object
      const messageForResponse = {
        _id: messageDoc._id.toString(),
        uuid: messageDoc.uuid,
        conversation: messageDoc.conversation.toString(),
        sender: displaySender,
        content: messageDoc.content,
        attachments: messageDoc.attachments || [],
        is_read: messageDoc.is_read,
        is_deleted: messageDoc.is_deleted,
        createdAt: messageDoc.createdAt || new Date(),
        updatedAt: messageDoc.updatedAt || new Date(),
      };

      // Get other participants (not the sender)
      const otherParticipants = conversation.participants.filter(
        (participant: any) => participant._id.toString() !== senderId.toString()
      );

      // Update unread counts for other participants
      await Promise.all(otherParticipants.map(async (participant: any) => {
        const participantId = participant._id.toString();
        const unreadData = await this.getUnreadMessageCount(participantId);

        // Notify via WebSocket about unread count change
        this.chatGateway.notifyUserOfNewMessages(participantId, unreadData?.data);
      }));

      return {
        success: true,
        message: "Message sent successfully",
        data: messageForResponse
      };
    } catch (error) {
      // console.error('Error in sendMessage:', error);
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

      const count = await this.conversationModel.countDocuments(baseQuery);

      const conversations = await this.conversationModel
        .find(baseQuery)
        .populate({
          path: "last_message",
          populate: [
            { path: "sender", select: "first_name last_name avatar email _id" },
          ],
        })
        .populate("participants", "first_name last_name avatar email _id")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const conversationsWithCounts = await Promise.all(
        conversations.map(async (conv) => {
          // Count unread messages not from this user
          const unreadCount = await this.messageModel.countDocuments({
            conversation: conv._id.toString(),
            sender: { $ne: userId.toString() },
            is_read: false,
            is_deleted: false,
          });

          // Map participants: if vendor, replace name/avatar with shopname/logo
          const participants = await Promise.all(
            conv.participants.map(async (p: any) => {
              // Check if participant is a vendor
              const vendor = await this.vendorModel.findOne({ user: p._id.toString() }).lean();
              if (vendor) {
                return {
                  _id: p._id,
                  first_name: vendor.name,
                  last_name: "",
                  avatar: vendor.logo,
                  email: p.email
                };
              }
              return p;
            })
          );

          const otherParticipants = participants.filter(
            (p) => p._id.toString() !== userId.toString()
          );

          return {
            ...conv.toObject(),
            other_participants: otherParticipants,
            unread_count: unreadCount,
            participants, // updated participants list
          };
        })
      );

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

  async getConversation(conversationId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      let conversation = await this.conversationModel
        .findById(conversationId)
        .populate({
          path: "last_message",
          populate: [
            { path: "sender", select: "first_name last_name avatar email _id" },
          ],
        })
        .populate("participants", "first_name last_name avatar email _id")
        .exec();

      if (!conversation) {
        throw new NotFoundException("Conversation not found");
      }

      // Count unread messages not from this user
      const unreadCount = await this.messageModel.countDocuments({
        conversation: conversation._id.toString(),
        sender: { $ne: userId.toString() },
        is_read: false,
        is_deleted: false,
      });

      // Map participants (replace with vendor data if needed)
      const participants = await Promise.all(
        conversation.participants.map(async (p: any) => {
          const vendor = await this.vendorModel.findOne({ user: p._id.toString() }).lean();
          if (vendor) {
            return {
              _id: p._id,
              first_name: vendor.name,
              last_name: "",
              avatar: vendor.logo,
              email: p.email,
            };
          }
          return p;
        })
      );

      const otherParticipants = participants.filter(
        (p) => p._id.toString() !== userId.toString()
      );

      return {
        success: true,
        message: "Conversation fetched successfully",
        data: {
          ...conversation.toObject(),
          participants,
          other_participants: otherParticipants,
          unread_count: unreadCount,
        },
      };
    } catch (error) {
      console.error("Error in getConversation:", error);
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
          sender: { $ne: userId.toString() },
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

    const conversations = await this.conversationModel
      .find({ participants: userId, is_deleted: false })
      .select('_id');

    const conversationIds = conversations.map(c => c._id.toString());

    const unreadCount = await this.messageModel.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: userId.toString() },
      is_read: false,
      is_deleted: false
    });

    return {
      success: true,
      message: "Unread messages found successfully",
      data: unreadCount
    };
  }

}
