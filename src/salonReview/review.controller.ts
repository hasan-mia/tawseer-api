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
import { ReviewDto } from './dto/review.dto';
import { ReviewService } from './review.service';

@Controller('review')
export class ReviewController {
  constructor(private reviewService: ReviewService) { }

  // ======== Create review ========
  @Put('create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReview(@Body() data: ReviewDto, @Request() req) {
    const user = req.user;
    return this.reviewService.createReview(user.id, data);
  }

  // ======== Update review ========
  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateReview(@Body() data: ReviewDto, @Request() req) {
    const user = req.user;
    const postId = req.params.id;
    return this.reviewService.updateReview(user.id, postId, data);
  }


  // ======== Get review by salon id ========
  @Get('salon/:id')
  @HttpCode(HttpStatus.OK)
  async getReviewBySalonId(@Request() req) {
    return this.reviewService.getReviewBySalonId(req);
  }

  // ======== Get review by service id ========
  @Get('service/:id')
  @HttpCode(HttpStatus.OK)
  async getReviewByServiceId(@Request() req) {
    return this.reviewService.getReviewByServiceId(req);
  }
}
