import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { RedisCacheService } from 'src/rediscloud.service';
import { User } from 'src/schemas/user.schema';
import { OtpDto } from './dto/otp.dto';
import { SigninDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private smsService: SmsService,
    private readonly redisCacheService: RedisCacheService,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) { }

  // =================================//
  //          Authentiation           //
  //==================================//

  // =============== Varify otp =================

  async signUp(data: SignUpDto) {
    const { mobile } = data;

    // Check if user with the provided mobile number already exists
    const existingUser = await this.userModel.findOne({ mobile });

    if (existingUser) {
      // If user already exists, update their OTP
      const otp = 1234;
      await this.userModel.findOneAndUpdate({ mobile }, { otp });
      // Send OTP via SMS
      await this.smsService.sendOtpSms(mobile, otp);
    } else {
      // If user does not exist, create a new user
      const otp = 1234;
      const user = await this.userModel.create({
        mobile,
        role: 'admin',
        user_type: 4,
        otp,
      });

      await user.save();
      // Send OTP via SMS
      await this.smsService.sendOtpSms(mobile, otp);
    }

    return { message: `Sending OTP to ${mobile} success` };
  }

  // =============== Varify otp =================
  async verifyOtp(data: OtpDto): Promise<{ token: string }> {
    const { mobile, otp } = data;
    const user = await this.userModel.findOne({ mobile, otp });

    if (!user) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear the OTP after successful verification
    await this.userModel.findOneAndUpdate({ mobile }, { otp: '' });

    // Generate JWT token
    const token = this.jwtService.sign({ id: user._id });

    const result = {
      message: 'Successfully Varify',
      token: token,
    };

    return result;
  }

  // =========Signin with email & password =============
  async signIn(data: SigninDto) {
    const { email, password } = data;

    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new NotFoundException('Wrong email');
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (!isPasswordMatched) {
      throw new NotFoundException('Wrong password');
    }

    const token = this.jwtService.sign({ id: user._id });

    const result = {
      message: 'Successfully login',
      token: token,
    };

    return result;
  }

  // =========Ge My Info use =============
  async getMyInfo(id: string) {
    try {
      const cacheKey = `myInfo${id}`;

      // Try to fetch all vehicles from cache
      const cachedMyInfo = await this.redisCacheService.get(cacheKey);
      if (cachedMyInfo) {
        return cachedMyInfo;
      }
      // Check existing USER
      const user = await this.userModel
        .findById(id)
        .select({ __v: 0, password: 0, otp: 0 })
        .populate({
          path: 'profile',
          select: '-__v',
        })
        .populate({
          path: 'locations',
          select: '-__v',
        })
        .populate({
          path: 'topup',
          select: '-__V',
        })
        .populate({
          path: 'withdraw',
          select: '-__V',
        })
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Cache the fetched vehicles data
      await this.redisCacheService.set(cacheKey, user, 1800);

      return user;
    } catch (error) {
      throw new Error(`Failed to get vehicle: ${error.message}`);
    }
  }

  // =================================//
  //           User Services          //
  //==================================//
  async userSignUp(data: SignUpDto) {
    const { mobile } = data;

    // Check if user with the provided mobile number already exists
    const existingUser = await this.userModel.findOne({ mobile });

    if (existingUser) {
      // If user already exists, update their OTP
      const otp = 1234;
      await this.userModel.findOneAndUpdate({ mobile }, { otp });
      // Send OTP via SMS
      await this.smsService.sendOtpSms(mobile, otp);
    } else {
      // If user does not exist, create a new user
      const otp = 1234;
      const user = await this.userModel.create({ mobile, otp });

      await user.save();
      // Send OTP via SMS
      await this.smsService.sendOtpSms(mobile, otp);
    }

    return { message: `Sending OTP to ${mobile} success` };
  }

  // =================================//
  //          Common function         //
  //==================================//

  // Generate 4 digit OTP
  async generateRandomFourDigitOtp() {
    return await Math.floor(1000 + Math.random() * 9000);
  }
}
