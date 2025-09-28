import { generateRandomFourDigitOtp } from '@/helpers/otp.helper';
import { RedisCacheService } from '@/rediscloud.service';
import { Vendor } from '@/schemas/vendor.schema';
import {
  BadRequestException,
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
import { User } from 'src/schemas/user.schema';
import { OtpDto } from './dto/otp.dto';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto, UserRole } from './dto/signup.dto';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly redisCacheService: RedisCacheService,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Vendor.name)
    private vendorModel: Model<Vendor>
  ) { }

  // =============== Sign up  with email & password=================

  async signUp(data: SignUpDto) {
    const { first_name, last_name, birth_date, fcmToken, email, password, role } = data;
    const exist = await this.userModel.findOne({ email });

    if (exist) {
      throw new ConflictException('Email address is already registered');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.userModel.create({
        first_name,
        last_name,
        email,
        password: hashedPassword,
        role: role ?? UserRole.User,
        birth_date,
        fcmToken,
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // =========SignIn with email & password =============
  async signIn(data: SignInDto) {
    const { email, password, fcmToken } = data;

    try {
      const user = await this.userModel.findOne({ email });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const isPasswordMatched = await bcrypt.compare(password, user.password);

      if (!isPasswordMatched) {
        throw new NotFoundException('Password is wrong.');
      }

      if (fcmToken) {
        await this.userModel.findOneAndUpdate({ email }, { fcmToken });
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // =========Forgot password with OTP=============
  async forgotPassword(data: OtpDto) {
    const { email } = data;

    try {
      const user = (await this.userModel.findOne({ email }).populate('_id otp email first_name last_name'));

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      // Generate OTP
      const otp = generateRandomFourDigitOtp();

      // Save OTP to the user document
      user.otp = otp;
      await user.save();

      const name = user?.first_name + " " + user?.last_name || 'Sir..';

      // Email data
      const emailOptions = {
        name: name,
        email: email,
        subject: 'Password Reset OTP',
        message: `<p>Your OTP for password reset is: <strong>${otp}</strong></p>`,
      };

      // Send OTP via email
      this.emailService.sendOtp(emailOptions);

      const result = {
        success: true,
        message: 'An OTP has been sent to your email.',
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // =============== Varify otp =================
  async varifyOtp(data: OtpDto) {
    try {
      const { email, otp } = data;
      const user = await this.userModel.findOne({ email, otp });

      if (!user) {
        throw new UnauthorizedException('Invalid OTP');
      }

      // Clear the OTP after successful verification
      await this.userModel.findOneAndUpdate({ email }, { otp: '' });

      // Generate JWT token
      const token = this.jwtService.sign(
        { id: user._id },
        { expiresIn: '1m' }
      );

      const result = {
        message: 'Successfully verified',
        token: token,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // =============== Reset password with otp =================
  async resetPassword(userId: string, data: OtpDto) {
    try {
      const { password } = data;
      const user = await this.userModel.findOne({ _id: userId });

      if (!user) {
        throw new UnauthorizedException('Invalid OTP');
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      await this.userModel.findOneAndUpdate({ _id: userId }, { password: hashedPassword });

      const result = {
        message: 'Password reset successfully',

      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // =========Ge My Info =============
  async getMyInfo(id: string) {
    try {
      const cacheKey = `myInfo${id}`;


      const cachedMyInfo = await this.redisCacheService.get(cacheKey);

      if (cachedMyInfo) {
        return { success: true, data: cachedMyInfo };
      }

      const user = await this.userModel
        .findOne({ _id: id })
        .select('-password')
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      let result: any = user.toObject();

      if (user.role === 'vendor') {
        const vendorInfo = await this.vendorModel.findOne({ user: id }).select('name logo cover type mobile slug')
        result.vendorInfo = vendorInfo
      }

      await this.redisCacheService.set(cacheKey, user, 60);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to get vehicle: ${error.message}`);
    }
  }

  // Update FCM TOKEN
  async updateFcmToken(userId: string, fcmToken: string) {
    try {
      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { fcmToken },
        { new: true }
      );

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Clear Redis cache for user info
      const cacheKey = `myInfo${userId}`;
      await this.redisCacheService.del(cacheKey);

      return {
        success: true,
        message: 'FCM token updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update FCM token');
    }

  }


}
