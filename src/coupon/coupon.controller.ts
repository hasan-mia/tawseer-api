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
import { CouponService } from './coupon.service';
import { CouponDto } from './dto/coupon.dto';

@Controller('coupon')
export class CouponController {
  constructor(private reviewService: CouponService) { }

  // ======== Create coupon ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCoupon(@Body() data: CouponDto, @Request() req) {
    const user = req.user;
    return this.reviewService.createCoupon(user.id, data);
  }

  // ======== Update coupon ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateCoupon(@Body() data: CouponDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id;
    return this.reviewService.updateCoupon(user.id, postId, data);
  }


  // ======== Get coupon by salon id ========
  @Get('salon/:id')
  @HttpCode(HttpStatus.OK)
  async getCouponBySalonId(@Request() req) {
    return this.reviewService.getCouponBySalonId(req);
  }


}
