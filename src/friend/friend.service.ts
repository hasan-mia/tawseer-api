import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RedisCacheService } from '../rediscloud.service';
import { Friend } from '../schemas/friend.schema';
import { User } from '../schemas/user.schema';

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
  async sendFriendRequest(userId: string, friendId: string) {
    try {
      // Validate input IDs
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
        throw new BadRequestException('Invalid user or friend ID');
      }

      // Check if user is trying to add themselves as a friend
      if (userId === friendId) {
        throw new BadRequestException('Cannot send friend request to yourself');
      }

      // Find both users to ensure they exist
      const [userDoc, friendDoc] = await Promise.all([
        this.userModel.findById(userId),
        this.userModel.findById(friendId)
      ]);

      if (!userDoc || !friendDoc) {
        throw new NotFoundException('User not found');
      }

      // Check if users are already friends
      if (
        (userDoc.friends && userDoc.friends.includes(friendId)) ||
        (friendDoc.friends && friendDoc.friends.includes(userId))
      ) {
        throw new BadRequestException('Users are already friends');
      }

      // Check if there's an existing request (in either direction)
      const existingRequest = await this.friendModel.findOne({
        $or: [
          { user: userId, friend: friendId },
          { user: friendId, friend: userId }
        ]
      });

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          // If the other user already sent a request, accept it
          if (existingRequest.user.toString() === friendId) {
            return this.acceptFriendRequest(userId, friendId);
          }
          throw new BadRequestException('Friend request already sent');
        } else if (existingRequest.status === 'accepted') {
          throw new BadRequestException('Users are already friends');
        } else if (existingRequest.status === 'rejected') {
          // Update the rejected request to pending
          existingRequest.status = 'pending';
          await existingRequest.save();

          // Update following relationship
          await Promise.all([
            this.userModel.findByIdAndUpdate(
              userId,
              { $addToSet: { followings: friendId } },
              { new: true }
            ),
            this.userModel.findByIdAndUpdate(
              friendId,
              { $addToSet: { followers: userId } },
              { new: true }
            )
          ]);

          return {
            success: true,
            message: 'Friend request sent successfully',
            data: existingRequest
          };
        }
      }

      // Create new friend request
      const friendRequest = await this.friendModel.create({
        user: userId,
        friend: friendId
      });

      // Update following relationships
      await Promise.all([
        this.userModel.findByIdAndUpdate(
          userId,
          { $addToSet: { followings: friendId } },
          { new: true }
        ),
        this.userModel.findByIdAndUpdate(
          friendId,
          { $addToSet: { followers: userId } },
          { new: true }
        )
      ]);

      return {
        success: true,
        message: 'Friend request sent successfully',
        data: friendRequest
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Accept friend request ========
  async acceptFriendRequest(userId: string, friendId: string) {
    try {
      // Validate input IDs
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
        throw new BadRequestException('Invalid user or friend ID');
      }

      // Check if a pending friend request exists
      const existingRequest = await this.friendModel.findOne({
        user: userId,
        friend: friendId,
        status: 'pending'
      });

      if (!existingRequest) {
        throw new NotFoundException('No pending friend request found');
      }

      // Update friend request status to 'accepted'
      const friendRequest = await this.friendModel.findByIdAndUpdate(
        existingRequest._id,
        { status: 'accepted' },
        { new: true }
      );

      // Update both users' friends lists and maintain following/follower relationship
      await Promise.all([
        this.userModel.findByIdAndUpdate(
          userId,
          {
            $addToSet: {
              friends: friendId,
              followings: friendId
            }
          }
        ),
        this.userModel.findByIdAndUpdate(
          friendId,
          {
            $addToSet: {
              friends: userId,
              followings: userId
            }
          }
        )
      ]);

      return {
        success: true,
        message: 'Friend request accepted successfully',
        data: friendRequest
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Cancel friend request or unfriend ========
  async cancelFriendRequest(userId: string, friendId: string) {
    try {
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
        throw new BadRequestException('Invalid user or friend ID');
      }

      // Find friend requests between these users
      const deletedRequests = await this.friendModel.deleteMany({
        $or: [
          { user: userId, friend: friendId },
          { user: friendId, friend: userId }
        ]
      });

      if (deletedRequests.deletedCount === 0) {
        throw new NotFoundException('No friendship or request found between these users');
      }

      return {
        success: true,
        message: 'Friend request canceled successfully',
        data: { deletedCount: deletedRequests.deletedCount }
      };

      // // Update the status of all found friend requests to 'rejected'
      // const updatedFriendRequests = await Promise.all(
      //   friendRequests.map(async (request) => {
      //     request.status = 'rejected';
      //     return request.save();
      //   })
      // );

      // // Remove from friends lists
      // await Promise.all([
      //   this.userModel.findByIdAndUpdate(
      //     userId,
      //     { $pull: { friends: friendId } },
      //     { new: true }
      //   ),
      //   this.userModel.findByIdAndUpdate(
      //     friendId,
      //     { $pull: { friends: userId } },
      //     { new: true }
      //   )
      // ]);

      // // Remove from followers/followings lists
      // await Promise.all([
      //   this.userModel.findByIdAndUpdate(
      //     userId,
      //     {
      //       $pull: {
      //         followers: friendId,
      //         followings: friendId
      //       }
      //     },
      //     { new: true }
      //   ),
      //   this.userModel.findByIdAndUpdate(
      //     friendId,
      //     {
      //       $pull: {
      //         followers: userId,
      //         followings: userId
      //       }
      //     },
      //     { new: true }
      //   )
      // ]);

      // return {
      //   success: true,
      //   message: 'Friend request canceled or friendship removed successfully',
      //   data: friendRequests
      // };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get pending friend requests sent by the user ========
  async getPendingFriendRequests(userId: string) {
    try {
      // Validate input ID
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const pendingRequests = await this.friendModel.find({
        friend: userId,
        status: 'pending'
      }).populate('user', 'email first_name last_name avatar cover')
        .populate('friend', 'email first_name last_name avatar cover');

      return {
        success: true,
        message: 'Retrieved pending friend requests successfully',
        data: pendingRequests
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get sent friend requests received by the user ========
  async getSendingFriendRequests(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const pendingRequests = await this.friendModel.find({
        user: userId,
        status: 'pending'
      }).populate('user', 'email first_name last_name avatar cover')
        .populate('friend', 'email first_name last_name avatar cover');

      return {
        success: true,
        message: 'Retrieved incoming friend requests successfully',
        data: pendingRequests
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get my friend list ========
  async getMyFriendList(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      // Use cache if available
      const cacheKey = `friend_list_${userId}`;
      const cachedData = await this.redisCacheService.get(cacheKey);

      if (cachedData) {
        return {
          success: true,
          message: 'Retrieved friend list from cache',
          data: JSON.parse(cachedData)
        };
      }

      const user = await this.userModel.findById(userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.friends || user.friends.length === 0) {
        return {
          success: true,
          message: 'User has no friends',
          data: []
        };
      }

      // Populate friends data with relevant fields only
      const friendList = await this.userModel.find(
        { _id: { $in: user.friends } },
        'email first_name last_name avatar cover bio'
      );

      // Cache the result
      await this.redisCacheService.set(
        cacheKey,
        JSON.stringify(friendList),
        60 * 15 // 15 minutes
      );

      return {
        success: true,
        message: 'Retrieved friend list successfully',
        data: friendList
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get user friend list by ID ========
  async getFriendListByID(userId: string) {
    try {
      // Reuse the same implementation as getMyFriendList
      return this.getMyFriendList(userId);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }
}