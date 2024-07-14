import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { generateRandomFourDigitOtp } from 'src/helpers/otp.helper';
import { RedisCacheService } from 'src/rediscloud.service';
import { User } from 'src/schemas/user.schema';
import { OtpDto } from './dto/otp.dto';
import { SigninDto } from './dto/signin.dto';
import { SignUpDto, UserRole } from './dto/signup.dto';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private smsService: SmsService,
    private readonly redisCacheService: RedisCacheService,
    @InjectModel(User.name)
    private userModel: Model<User>,
    // eslint-disable-next-line prettier/prettier
  ) { }

  // =============== Sign up =================

  async signUp(data: SignUpDto) {
    const { email, password, role } = data;
    const exist = await this.userModel.findOne({ email });

    if (exist) {
      throw new ConflictException('Email address is already registered');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.userModel.create({
        email,
        password: hashedPassword,
        role: role ?? UserRole.User,
      });

      await user.save();

      const data = { id: user._id, role: user.role };
      const token = this.jwtService.sign(data);

      const result = {
        success: true,
        message: 'Signup success',
        data,
        token: token,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // =========Signin with email & password =============
  async signIn(data: SigninDto) {
    const { email, password } = data;

    try {
      const user = await this.userModel.findOne({ email });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const isPasswordMatched = await bcrypt.compare(password, user.password);

      if (!isPasswordMatched) {
        throw new NotFoundException('Password is wrong.');
      }

      const data = { id: user._id, role: user.role };
      const token = this.jwtService.sign(data);

      const result = {
        success: true,
        message: 'Login success',
        data,
        token: token,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // =========Signin with email & password =============
  async forgotPassword(data: OtpDto) {
    const { email } = data;

    try {
      const user = await this.userModel.findOne({ email });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      // generate otp
      const otp = generateRandomFourDigitOtp();

      user.otp = otp;
      await user.save();

      const result = {
        success: true,
        message: 'Sent opt to your email',
        data: otp,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // =============== Verify otp =================
  async resetPassword(data: OtpDto): Promise<{ token: string }> {
    const { email, otp } = data;
    const user = await this.userModel.findOne({ email, otp });

    if (!user) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear the OTP after successful verification
    await this.userModel.findOneAndUpdate({ email }, { otp: '' });

    // Generate JWT token
    const token = this.jwtService.sign({ id: user._id });

    const result = {
      message: 'Successfully verified',
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
        return { success: true, data: cachedMyInfo };
      }
      // Check existing USER
      const user = await this.userModel
        .findOne({ _id: id })
        .select('-password')
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Cache the fetched vehicles data
      await this.redisCacheService.set(cacheKey, user, 1800);

      return { success: true, data: user };
    } catch (error) {
      throw new Error(`Failed to get vehicle: ${error.message}`);
    }
  }
}
