import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { ReviewDto, ReviewUpdateDto } from './dto/review.dto';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private reviewService: ReviewService) { }

  // ======== Create review ========
  @Post('')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReview(@Body() data: ReviewDto, @Request() req) {
    return this.reviewService.createReview(req.user.id, data);
  }

  // ======== Update review ========
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async updateReview(@Param('id') reviewId: string, @Body() data: ReviewUpdateDto, @Request() req) {
    return this.reviewService.updateReview(req.user.id, reviewId, data);
  }

  // ======== Get reviews by service ID ========
  @Get('service/:id')
  @HttpCode(HttpStatus.OK)
  async getReviewByServiceId(@Param('id') serviceId: string, @Request() req) {
    return this.reviewService.getReviewsByType('service', serviceId, req);
  }

  // ======== Get reviews by vendor ID ========
  @Get('vendor/:id')
  @HttpCode(HttpStatus.OK)
  async getReviewByVendorId(@Param('id') vendorId: string, @Request() req) {
    return this.reviewService.getReviewsByType('vendor', vendorId, req);
  }

  // ======== Get reviews by product ID ========
  @Get('product/:id')
  @HttpCode(HttpStatus.OK)
  async getReviewByProductId(@Param('id') productId: string, @Request() req) {
    return this.reviewService.getReviewsByType('product', productId, req);
  }

  // ======== Get reviews by vendor, product, or service ID ========
  @Get(':type/:id')
  @HttpCode(HttpStatus.OK)
  async getReviews(@Param('type') type: string, @Param('id') id: string) {
    if (!['vendor', 'product', 'service'].includes(type)) {
      return { success: false, message: 'Invalid type. Must be vendor, product, or service.' };
    }
    return this.reviewService.getReviewsByTypeId(type, id);
  }
}
