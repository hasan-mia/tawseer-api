/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CouponService } from './coupon.service';
import { CouponDto, CouponUpdateDto } from './dto/coupon.dto';

@Controller('coupons')
export class CouponController {
  constructor(private reviewService: CouponService) { }

  // ======== Create coupon ========
  @Post('')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCoupon(@Body() data: CouponDto, @Request() req) {
    const user = req.user;
    return this.reviewService.createCoupon(user.id, data);
  }

  // ======== Update coupon ========
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateCoupon(@Body() data: CouponUpdateDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id;
    return this.reviewService.updateCoupon(user.id, postId, data);
  }


  // ======== Get coupon by salon id ========
  @Get('vendor/:id')
  @HttpCode(HttpStatus.OK)
  async getCouponByVendorId(@Request() req) {
    return this.reviewService.getCouponByVendorId(req);
  }


}
