/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Put,
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
  @Put('send-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendFriendRequest(
    @Body() data: FriendDto, @Request() req
  ) {
    const user = req.user;
    return this.friendService.sendFriendRequest(user.id, data, req);

  }



}
