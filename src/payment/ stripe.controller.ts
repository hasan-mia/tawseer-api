import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { StripePaymentDto } from './dto/stripepayment.dto';
import { StripeService } from './stripe.service';

@Controller('car-wash/stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('payment')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async createPayment(@Body() data: StripePaymentDto, @Request() req) {
    const user = req.user;

    try {
      return await this.stripeService.processPayment(user.id, data);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
