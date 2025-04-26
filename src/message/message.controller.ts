import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateMessageDto } from './dto/message.dto';
import { MessageService } from './message.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) { }

  @Post()
  async sendMessage(@Body() createMessageDto: CreateMessageDto, @Request() req) {
    // Ensure the sender is the authenticated user
    createMessageDto.senderId = req.user._id;
    return this.messageService.sendMessage(createMessageDto);
  }

  @Get('conversations')
  async getConversations(@Request() req) {
    return this.messageService.getConversations(req.user._id);
  }

  @Get('conversation/:conversationId')
  async getMessagesByConversation(
    @Param('conversationId') conversationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Request() req
  ) {
    return this.messageService.getMessagesByConversation(
      conversationId,
      req.user._id,
      page,
      limit,
    );
  }

  @Patch('read/:messageId')
  async markAsRead(@Param('messageId') messageId: string) {
    return this.messageService.markMessageAsRead(messageId);
  }

  @Delete(':messageId')
  async deleteMessage(@Param('messageId') messageId: string, @Request() req) {
    return this.messageService.deleteMessage(messageId, req.user._id);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const count = await this.messageService.getUnreadMessageCount(req.user._id);
    return { count };
  }
}