/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UserSchema } from 'src/schemas/user.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { JwtStrategy } from './jwt.strategy';
import { SmsService } from './sms.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: config.get<string | number>('JWT_SECRET_EXPIRES'),
          },
        };
      },
    }),
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }, { name: 'Vendor', schema: VendorSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, SmsService, JwtStrategy, RedisCacheService, EmailService],
  exports: [JwtStrategy, PassportModule, AuthService],
})
// eslint-disable-next-line prettier/prettier
export class AuthModule { }
