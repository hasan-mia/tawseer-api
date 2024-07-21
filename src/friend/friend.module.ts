/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { RedisCacheService } from 'src/rediscloud.service';
import { FriendSchema } from 'src/schemas/friend.schema';
import { UserSchema } from '../schemas/user.schema';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }, { name: 'Friend', schema: FriendSchema }])],
  controllers: [FriendController],
  providers: [FriendService, CloudinaryService, RedisCacheService],
  exports: [FriendService],
})
export class FriendModule { }
