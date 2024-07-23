/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ReplyDto } from './dto/reply.dto';
import { ReplyService } from './reply.service';

@Controller('reply')
export class ReplyController {
  constructor(private reviewService: ReplyService) { }

  // ======== Create reply ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReply(@Body() data: ReplyDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id
    return this.reviewService.createReply(user.id, postId, data);
  }

  // ======== Update reply ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateReply(@Body() data: ReplyDto, @Request() req) {
    const user = req.user;
    const commentId = req.params.id;
    return this.reviewService.updateReply(user.id, commentId, data);
  }


  // ======== Get reply by comment id ========
  @Get('salon/:id')
  @HttpCode(HttpStatus.OK)
  async getReplyByCommentId(@Request() req) {
    return this.reviewService.getReplyByCommentId(req);
  }


}
