/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { FriendDto } from './dto/friend.dto';
import { FriendService } from './friend.service';

@Controller('friends')
export class FriendController {
  constructor(
    private friendService: FriendService,
  ) { }

  // ======== Send friend request ========
  @Post('send-request/:firendId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendFriendRequest(@Body() data: FriendDto, @Request() req) {
    const user = req.user;
    const friend = req.params.firendId;
    return this.friendService.sendFriendRequest(user.id, friend);

  }

  // ======== Accept friend request ========
  @Post('accept-request/:friendId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async acceptFriendRequest(@Body() data: FriendDto, @Request() req) {
    const user = req.user;
    const friend = req.params.friendId;
    return this.friendService.acceptFriendRequest(user.id, friend);

  }

  // ======== Cancel friend request ========
  @Delete('cancel-request/:friendId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelFriendRequest(@Body() data: FriendDto, @Request() req) {
    const user = req.user;
    const friend = req.params.friendId;
    return this.friendService.cancelFriendRequest(user.id, friend);

  }

  // ======== Pending friend request ========
  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async pendingFriendRequest(@Request() req) {
    const user = req.user;
    return this.friendService.getPendingFriendRequests(user.id);

  }

  // ======== Sent friend request ========
  @Get('sent')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendingFriendRequest(@Request() req) {
    const user = req.user;
    return this.friendService.getSendingFriendRequests(user.id);

  }

  // ======== My friend list ========
  @Get('')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMyFriendList(@Request() req) {
    const user = req.user;
    return this.friendService.getMyFriendList(user.id);

  }

  // ======== User friend list by ID ========
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getFriendListByID(@Request() req) {
    const userId = req.params.id;
    return this.friendService.getFriendListByID(userId);

  }

}
