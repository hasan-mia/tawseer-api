import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
  async sendOtpSms(mobile: string, otp: number) {
    return `Sending OTP to ${mobile}: Your OTP is ${otp}`;
  }
}
