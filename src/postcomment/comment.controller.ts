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
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';

@Controller('comment')
export class CommentController {
  constructor(private reviewService: CommentService) { }

  // ======== Create comment ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createComment(@Body() data: CommentDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id
    return this.reviewService.createComment(user.id, postId, data);
  }

  // ======== Update comment ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateComment(@Body() data: CommentDto, @Request() req) {
    const user = req.user;
    const commentId = req.params.id;
    return this.reviewService.updateComment(user.id, commentId, data);
  }


  // ======== Get comment by post id ========
  @Get('salon/:id')
  @HttpCode(HttpStatus.OK)
  async getCommentByPostId(@Request() req) {
    return this.reviewService.getCommentByPostId(req);
  }


}
