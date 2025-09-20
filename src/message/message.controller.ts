import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Request,
  UseGuards
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateMessageDto } from './dto/message.dto';
import { MessageService } from './message.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) { }

  // Start a new conversation between two users
  @Post('start')
  @UseGuards(JwtAuthGuard)
  async createConversation(@Body('participantIds') participantIds: string[], @Request() req) {
    const objectIds = participantIds.map((id) => new Types.ObjectId(id));
    return this.messageService.findOrCreateConversation(objectIds, req.user._id);
  }

  // Send a message inside an existing conversation
  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Body() createMessageDto: CreateMessageDto, @Request() req) {
    const userId = req.user._id;
    const { senderId } = createMessageDto;

    if (userId.toString() !== senderId) throw new NotFoundException("Can't send to other conversation");

    return this.messageService.sendMessage(createMessageDto);
  }

  // Get all conversations of logged-in user
  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async getConversations(@Request() req) {
    return this.messageService.getConversations(req.user._id, req);
  }

  // Get total unread message count for logged-in user
  @Get('unread')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Request() req) {
    return await this.messageService.getUnreadMessageCount(req.user._id);
  }

  // Get a specific conversation
  @Get('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async getConversation(
    @Param('conversationId') conversationId: string,
    @Request() req,
  ) {
    const convId = new Types.ObjectId(conversationId)
    return this.messageService.getConversation(
      convId,
      req.user._id,
    );
  }

  // Get messages from a specific conversation with pagination
  @Get(':conversationId')
  @UseGuards(JwtAuthGuard)
  async getMessagesByConversation(
    @Param('conversationId') conversationId: string,
    @Request() req,
  ) {
    return this.messageService.getMessagesByConversation(
      conversationId,
      req.user._id,
      req,
    );
  }

  // Mark a single message as read
  @Put('read/:messageId')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('messageId') messageId: string, @Request() req) {
    const userId = req.user._id;
    return this.messageService.markMessageAsRead(messageId, userId);
  }

  // Delete a message (only if user is sender)
  @Delete(':messageId')
  @UseGuards(JwtAuthGuard)
  async deleteMessage(@Param('messageId') messageId: string, @Request() req) {
    return this.messageService.deleteMessage(messageId, req.user._id);
  }

}
