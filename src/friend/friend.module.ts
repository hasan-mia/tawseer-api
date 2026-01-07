/* eslint-disable prettier/prettier */
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { FriendSchema } from '@/schemas/friend.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../schemas/user.schema';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }, { name: 'Friend', schema: FriendSchema }])],
  controllers: [FriendController],
  providers: [FriendService, CloudinaryService],
  exports: [FriendService],
})
export class FriendModule { }
