/* eslint-disable prettier/prettier */
import { RedisCacheService } from '@/rediscloud.service';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { UserSchema } from '../schemas/user.schema';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }, { name: 'Vendor', schema: VendorSchema }])],
  controllers: [UserController],
  providers: [UserService, CloudinaryService, RedisCacheService],
  exports: [UserService],
})
export class UserModule { }
