/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PostDto } from './dto/post.dto';
import { PostService } from './post.service';

@Controller('post')
export class PostController {
  constructor(
    private salonService: PostService,
  ) { }

  // ======== Create Post ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @Body() data: PostDto, @Request() req
  ) {
    const user = req.user;
    return this.salonService.createPost(user.id, data);

  }

  // ======== Update post ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updatePost(
    @Body() data: PostDto, @Request() req
  ) {
    const user = req.user;
    const postId = req.params.id;
    return this.salonService.updatePost(user.id, postId, data);

  }

  // ======== Get all post ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllPost(@Request() req) {
    return this.salonService.getAllPost(req);
  }

  // ======== Get post details by id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getPostDetails(@Request() req) {
    const id = req.params.id;
    return this.salonService.getPostDetails(id);
  }


}
