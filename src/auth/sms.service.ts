import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
  async sendOtpSms(mobile: string, otp: number) {
    console.log(`Sending OTP to ${mobile}: Your OTP is ${otp}`);
  }
}
