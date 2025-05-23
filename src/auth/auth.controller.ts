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
import { AuthService } from './auth.service';
import { OtpDto } from './dto/otp.dto';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './role.guard';

// ===============================//
//           Auth Controller      //
//================================//
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  userSignUp(@Body() data: SignUpDto) {
    return this.authService.signUp(data);
  }

  // ======== Sing with email and password ========
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() data: SignInDto) {
    return this.authService.signIn(data);
  }

  // ======== Forgot password ========
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() data: OtpDto) {
    return this.authService.forgotPassword(data);
  }

  // ======== Reset otp ========
  @Put('varify-otp')
  @HttpCode(HttpStatus.OK)
  varifyOtp(@Body() data: OtpDto) {
    return this.authService.varifyOtp(data);
  }

  // ======== Reset otp ========
  @Put('reset-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() data: OtpDto, @Request() req) {
    const user = req.user;
    return this.authService.resetPassword(user.id, data);
  }

  // ======== Get my Information ========
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  getMyInfo(@Request() req) {
    const user = req.user;
    return this.authService.getMyInfo(user.id);
  }
}
