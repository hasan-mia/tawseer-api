/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FriendDto } from './dto/friend.dto';
import { FriendService } from './friend.service';

@Controller('friend')
export class FriendController {
  constructor(
    private friendService: FriendService,
  ) { }

  // ======== Send friend request ========
  @Post('send-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendFriendRequest(
    @Body() data: FriendDto, @Request() req
  ) {
    const user = req.user;
    return this.friendService.sendFriendRequest(user.id, data);

  }

  // ======== Accept friend request ========
  @Post('accept-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async acceptFriendRequest(
    @Body() data: FriendDto, @Request() req,
  ) {
    const user = req.user;
    return this.friendService.acceptFriendRequest(user.id, data);

  }

  // ======== Cancel friend request ========
  @Post('cancel-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async cancelFriendRequest(
    @Body() data: FriendDto, @Request() req,
  ) {
    const user = req.user;
    return this.friendService.cancelFriendRequest(user.id, data);

  }

  // ======== Pending friend request ========
  @Post('pending-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async pendingFriendRequest(
    @Request() req,
  ) {
    const user = req.user;
    return this.friendService.getPendingFriendRequests(user.id);

  }

  // ======== Sending friend request ========
  @Post('sending-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendingFriendRequest(
    @Request() req,
  ) {
    const user = req.user;
    return this.friendService.getSendingFriendRequests(user.id);

  }

  // ======== My friend list ========
  @Post('my-friend-list')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async getMyFriendList(
    @Request() req,
  ) {
    const user = req.user;
    return this.friendService.getMyFriendList(user.id);

  }

  // ======== User friend list by ID ========
  @Post('user-friend-list')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async getFriendListByID(
    @Request() req,
  ) {
    const user = req.user;
    return this.friendService.getFriendListByID(user.id);

  }

}
