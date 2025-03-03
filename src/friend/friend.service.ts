/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisCacheService } from '../rediscloud.service';
import { Friend } from '../schemas/friend.schema';
import { User } from '../schemas/user.schema';
import { FriendDto } from './dto/friend.dto';

@Injectable()
export class FriendService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Friend.name)
    private friendModel: Model<Friend>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Send friend request ========
  async sendFriendRequest(user: string, friend: string) {
    try {
      const existingRequest = await this.friendModel.findOne({
        user: user,
        friend: friend,
        status: 'pending',
      });


      if (existingRequest) {
        throw new NotFoundException('Friend request already sent');
      }

      // Check if the users are already friends
      const userDoc = await this.userModel.findById(user)
      const friendDoc = await this.userModel.findById(friend)

      if (!userDoc || !friendDoc) {
        throw new NotFoundException('User not found');
      }

      if (
        (userDoc.friends && userDoc.friends.includes(friend)) ||
        (friendDoc.friends && friendDoc.friends.includes(user))
      ) {
        throw new NotFoundException('Users are already friends');
      }

      // send friend request
      const friendRequest = await this.friendModel.create({ user: user, friend: friend })

      if (!friendRequest) {
        throw new NotFoundException('Failed to send friend request');
      }

      // Update following for the user who sent the request
      await this.userModel.findByIdAndUpdate(
        user,
        { $addToSet: { followings: friend } },
        { new: true },
      )

      // Update followers for the user who received the request
      await this.userModel.findByIdAndUpdate(
        friend,
        { $addToSet: { followers: user } },
        { new: true },
      )

      const result = {
        success: true,
        message: 'Send friend request success',
        data: friendRequest,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Accept friend request ========
  async acceptFriendRequest(user: string, friend: string) {
    try {
      // Check if a pending friend request exists
      const existRequest = await this.friendModel.findOne({
        user: friend,
        friend: user,
        status: 'pending',
      });

      if (!existRequest) {
        throw new NotFoundException('No pending friend request found');
      }

      // Update friend request status to 'accepted'
      const friendRequest = await this.friendModel.findByIdAndUpdate(
        existRequest._id,
        { status: 'accepted' },
        { new: true }
      );

      if (!friendRequest) {
        throw new NotFoundException('Failed to accept friend request');
      }

      // Update both users' friends lists
      await this.userModel.findByIdAndUpdate(user, { $addToSet: { friends: friend } });
      await this.userModel.findByIdAndUpdate(friend, { $addToSet: { friends: user } });

      return {
        success: true,
        message: 'Friend request accepted successfully',
        data: friendRequest,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }


  // ======== Cancel friend request ========
  async cancelFriendRequest(id: string, data: FriendDto) {

    const { friendId } = data
    try {

      // Find friend requests where fromUser or toUser matches friendId
      const friendRequests = await this.friendModel.find({
        $or: [{ user: friendId }, { friend: friendId }],
      });


      // Update the status of all found friend requests to 'rejected'
      const updatedFriendRequests = await Promise.all(
        friendRequests.map(async (friendRequest) => {
          friendRequest.status = 'rejected'
          return friendRequest.save()
        }),
      )

      // ==============Unfriend===================
      // Update the 'user' field
      await this.userModel.findByIdAndUpdate(
        id,
        { $pull: { friends: friendId } },
        { new: true },
      )

      // Update the 'friends' field
      await this.userModel.findByIdAndUpdate(
        friendId,
        { $pull: { friends: id } },
        { new: true },
      )

      // ==============Un follower & UnFollow===================
      // Update the 'followings' field
      await this.userModel.findByIdAndUpdate(
        friendId,
        { $pull: { followings: id } },
        { new: true },
      )
      await this.userModel.findByIdAndUpdate(
        id,
        { $pull: { followings: friendId } },
        { new: true },
      )

      // Update the 'followers' field
      await this.userModel.findByIdAndUpdate(
        friendId,
        { $pull: { followers: id } },
        { new: true },
      )
      await this.userModel.findByIdAndUpdate(
        id,
        { $pull: { followers: friendId } },
        { new: true },
      )


      const result = {
        success: true,
        message: 'Send friend request success',
        data: updatedFriendRequests,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get pending friend request ========
  async getPendingFriendRequests(id: string) {

    try {
      const pendingRequests = await this.friendModel.find({
        user: id,
        status: 'pending'
      }).populate('friend', 'email first_name last_name avatar cover')

      const result = {
        success: true,
        message: 'Found pending friend request success',
        data: pendingRequests,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get sending friend request ========
  async getSendingFriendRequests(id: string) {

    try {
      const pendingRequests = await this.friendModel.find({
        friend: id,
        status: 'pending'
      }).populate('friend', 'email first_name last_name avatar cover')

      const result = {
        success: true,
        message: 'Found pending friend request success',
        data: pendingRequests,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get my friend list ========
  async getMyFriendList(id: string) {
    let friendList: any;
    try {
      const user = await this.userModel.findById(id).exec()

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.friends || user.friends.length === 0) {
        friendList = []
      }

      // Populate each friend ID in the array
      friendList = await Promise.all(
        user.friends.map(async (friendId) => {
          return await this.userModel.findById(friendId)
        }),
      )

      const result = {
        success: true,
        message: 'Found friend request success',
        data: friendList,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get user friend list by ID ========
  async getFriendListByID(id: string) {
    let friendList: any;
    try {

      const user = await this.userModel.findById(id).exec()

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.friends || user.friends.length === 0) {
        friendList = []
      }

      // Populate each friend ID in the array
      friendList = await Promise.all(
        user.friends.map(async (friendId) => {
          return await this.userModel.findById(friendId)
        }),
      )

      const result = {
        success: true,
        message: 'Found friend request success',
        data: friendList,
      };

      return result;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
