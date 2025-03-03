/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ReplyDto } from './dto/reply.dto';
import { ReplyService } from './reply.service';

@Controller('replies')
export class ReplyController {
  constructor(private replyService: ReplyService) { }

  // ======== Create reply ========
  @Post(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReply(@Body() data: ReplyDto, @Request() req) {
    const user = req.user;
    const commentId = req.params.id
    return this.replyService.createReply(user.id, commentId, data);
  }

  // ======== Update reply ========
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateReply(@Body() data: ReplyDto, @Request() req) {
    const user = req.user;
    const replyId = req.params.id;
    return this.replyService.updateReply(user.id, replyId, data);
  }

  // ======== Delete reply ========
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async deleteReply(@Request() req) {
    const user = req.user;
    const replyId = req.params.id;
    return this.replyService.deleteReply(user.id, replyId);
  }


  // ======== Get reply by comment id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getReplyByCommentId(@Request() req) {
    return this.replyService.getReplyByCommentId(req);
  }


}
