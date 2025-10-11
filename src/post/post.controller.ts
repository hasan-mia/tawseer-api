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
import { PostDto } from './dto/post.dto';
import { PostService } from './post.service';

@Controller('posts')
export class PostController {
  constructor(
    private postService: PostService,
  ) { }

  // ======== Create Post ========
  @Post('')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @Body() data: PostDto, @Request() req
  ) {
    const user = req.user;
    return this.postService.createPost(user.id, data);

  }

  // ======== Update post ========
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updatePost(
    @Body() data: PostDto, @Request() req
  ) {
    const user = req.user;
    const postId = req.params.id;
    return this.postService.updatePost(user.id, postId, data);

  }

  // ======== Get all post ========
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllPost(@Request() req) {
    return this.postService.getAllPost(req);
  }

  // ======== Get post details by id ========
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getPostDetails(@Request() req) {
    const id = req.params.id;
    return this.postService.getPostDetails(id);
  }

  // ======== Get all post by user id ========
  @Get('user/:id')
  @HttpCode(HttpStatus.OK)
  async getAllPostByUserID(@Request() req) {
    return this.postService.getAllPostByUserID(req);
  }

  // ======== Get all post by user id ========
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deletePost(@Request() req) {
    const postId = req.params.id;
    return this.postService.deletePost(postId);
  }

  // ======== Get post of user firend and following user ========
  @Get('')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getFriendsAndFollowingPosts(@Request() req) {
    return this.postService.getFriendsAndFollowingPosts(req);
  }


}
