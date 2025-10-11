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
  UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';

@Controller('comments')
export class CommentController {
  constructor(private commnetService: CommentService) { }

  // ======== Create comment ========
  @Post(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createComment(@Body() data: CommentDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id
    return this.commnetService.createComment(user.id, postId, data);
  }

  // ======== Update comment ========
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateComment(@Body() data: CommentDto, @Request() req) {
    const user = req.user;
    const commentId = req.params.id;
    return this.commnetService.updateComment(user.id, commentId, data);
  }

  // ======== Delete comment ========
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async deleteComment(@Request() req) {
    const user = req.user;
    const commentId = req.params.id;
    return this.commnetService.deleteComment(user.id, commentId);
  }


  // ======== Get comment by post id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getCommentByPostId(@Request() req) {
    return this.commnetService.getCommentByPostId(req);
  }


}
