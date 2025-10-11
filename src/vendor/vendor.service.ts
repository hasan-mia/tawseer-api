import { RedisCacheService } from '@/rediscloud.service';
import { VendorFollow } from '@/schemas/vendorFollow.schema';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '@/schemas/vendor.schema';
import { User } from '@/schemas/user.schema';
import { DayOfWeek, updateVendor } from './dto/updateVendor.dto';
import { VendorDto } from './dto/vendor.dto';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Vendor.name)
    private vendorModel: Model<Vendor>,
    @InjectModel(VendorFollow.name)
    private vendorFollowModel: Model<VendorFollow>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create new Vendor ========
  async createVendor(id: string, data: VendorDto) {
    try {
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.role !== 'vendor') {
        throw new BadRequestException('Only vendors can create a Vendor profile');
      }
      const exist = await this.vendorModel.findOne({ vendor: id }).exec();
      if (exist) {
        throw new BadRequestException('Vendor profile already exists');
      }

      if (data.is_verified) {
        throw new BadRequestException("You can't update varify status");
      }
      if (data.is_disabled) {
        throw new BadRequestException("You can't update disable status");
      }
      if (data.rating) {
        throw new BadRequestException("You can't update rating manually");
      }
      if (data.queue) {
        throw new BadRequestException("You can't update queue manually");
      }
      if (data.total_review) {
        throw new BadRequestException("You can't update review number manually");
      }

      // const slug = slugify(data.name, { lower: true, strict: true });

      const finalData = {
        user: id,
        ...data,
        // slug,
      };

      const saveData = await this.vendorModel.create(finalData);

      await this.redisCacheService.del('getAllVendor');

      return {
        success: true,
        message: 'Vendor created successfully',
        data: saveData,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Update Vendor Profile ========
  async updateVendor(id: string, vendorId: string, data: updateVendor) {

    try {
      const user = await this.userModel.findById(id)

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const existVendor = await this.vendorModel.findOne({ _id: vendorId, user: id })

      if (!existVendor) {
        throw new NotFoundException('Vendor not found');
      }

      if (data.is_verified) {
        throw new BadRequestException("You can't update varify status");
      }
      if (data.is_disabled) {
        throw new BadRequestException("You can't update disable status");
      }
      if (data.rating) {
        throw new BadRequestException("You can't update rating manually");
      }
      if (data.queue) {
        throw new BadRequestException("You can't update queue manually");
      }
      if (data.total_review) {
        throw new BadRequestException("You can't update review number manually");
      }

      const updatedVendorData = { ...existVendor.toObject(), ...data };

      const updatedVendor = await this.vendorModel.findByIdAndUpdate(existVendor._id, updatedVendorData, { new: true, upsert: true });

      // remove caching
      await this.redisCacheService.del('getAllVendor');
      await this.redisCacheService.del(`VendorInfo${existVendor._id}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedVendor,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get All Vendor ========
  async getAllVendor(req: any) {
    try {
      const {
        keyword,
        limit,
        page,
        user,
        type,
        longitude,
        latitude,
        radiusInMeters = 5000
      } = req.query;

      let perPage: number | undefined;
      if (limit && typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const searchCriteria: any = {
        is_deleted: { $ne: true },
        is_disabled: { $ne: true },
      };

      if (keyword) {
        searchCriteria.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { mobile: { $regex: keyword, $options: 'i' } },
        ];
      }

      if (user) {
        searchCriteria.user = user;
      }

      if (type) {
        if (type === 'salon' || type === 'parlor') {
          searchCriteria.type = { $in: ['salon', 'parlor'] };
        } else if (type === 'shop') {
          searchCriteria.type = 'shop';
        }
      }

      let query;
      let count;

      // Handle location-based queries differently
      if (longitude && latitude) {
        const parsedLongitude = parseFloat(longitude);
        const parsedLatitude = parseFloat(latitude);
        const parsedRadius = parseInt(radiusInMeters, 10);

        // For location queries, we need to use .find() with $near
        query = this.vendorModel.find({
          ...searchCriteria,
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parsedLongitude, parsedLatitude],
              },
              $maxDistance: parsedRadius,
            },
          },
        });

        // For count with location, we need to use $geoWithin (approximate count)
        count = await this.vendorModel.countDocuments({
          ...searchCriteria,
          location: {
            $geoWithin: {
              $centerSphere: [[parsedLongitude, parsedLatitude], parsedRadius / 6378100]
            }
          }
        });
      } else {
        // Regular query without location
        query = this.vendorModel.find(searchCriteria);
        count = await this.vendorModel.countDocuments(searchCriteria);
      }

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? perPage * (currentPage - 1) : 0;

      const result = await query
        .populate("user", "first_name last_name email mobile avatar")
        .select('slug name logo cover mobile address location rating queue total_review type is_verified')
        .skip(skip)
        .limit(perPage || 10)
        .sort({ createdAt: -1 })
        .exec();

      const totalPages = perPage ? Math.ceil(count / perPage) : 1;
      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (perPage && currentPage < totalPages) {
        nextPage = currentPage + 1;
        const params = new URLSearchParams(req.query);
        params.set('page', nextPage.toString());
        nextUrl = `${req.originalUrl.split('?')[0]}?${params.toString()}`;
      }

      const data = {
        success: true,
        message: "Fetched successfully",
        data: result || [],
        total: count,
        perPage,
        nextPage,
        nextUrl,
      };

      // // Cache the result
      // const cacheTTL = (longitude && latitude) ? 30 : 300; // Shorter TTL for location queries
      // await this.redisCacheService.set(cacheKey, data, cacheTTL);

      return data;
    } catch (error) {
      console.error('Error in getAllVendor:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Get single Vendor info by ID ========
  async getVendorInfo(slug: string) {
    try {

      const data = await this.vendorModel.findOne({ slug }).populate("user", "first_name last_name email mobile avatar username").exec();

      if (!data) {
        throw new NotFoundException('Vendor not found');
      }

      const result = {
        success: true,
        message: 'Vendor found successfully',
        data: data,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Find nearby vendors ========
  async findNearbyVendors(req: any) {

    const { limit, type, longitude, latitude, radius = 5000 } = req.query;

    if (!latitude || !longitude) {
      throw new BadRequestException('Latitude and longitude are required');
    }

    const query: any = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [91.825, 22.3569] // MongoDB uses [lng, lat]
          },
          $maxDistance: radius, // in meters
        },
      },
      is_deleted: false,
      is_disabled: false,
    };

    if (type) {
      query.type = type;
    }

    return this.vendorModel
      .find(query)
      .limit(limit)
      .populate('user', 'first_name last_name email mobile avatar username')
      .exec();
  }

  isVendorOpen(vendor: Vendor): boolean {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase().slice(0, 3) as DayOfWeek;
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    const todayHours = vendor.openingHours.find(
      hours => hours.day === currentDay && hours.isOpen
    );

    if (!todayHours) return false;

    return currentTime >= todayHours.opens && currentTime <= todayHours.closes;
  }

  async updateVendorLocation(vendorId: string, latitude: number, longitude: number) {
    return this.vendorModel.findByIdAndUpdate(
      vendorId,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      },
      { new: true },
    );
  }

  async getVendorsByBounds(
    northEast: { lat: number; lng: number },
    southWest: { lat: number; lng: number },
  ) {
    return this.vendorModel.find({
      location: {
        $geoWithin: {
          $box: [
            [southWest.lng, southWest.lat],
            [northEast.lng, northEast.lat],
          ],
        },
      },
      is_deleted: false,
      is_disabled: false,
    });
  }

  // =================================================//
  //                  Admin Dashboard                 //
  // =================================================//

  // ======== Update Vendor By Admin ========
  async updateVendorByAdmin(vendorId: string, data: updateVendor) {
    try {
      const existVendor = await this.vendorModel.findOne({ _id: vendorId })

      if (!existVendor) {
        throw new NotFoundException('Vendor not found');
      }

      const updatedVendorData = { ...existVendor.toObject(), ...data };

      const updatedVendor = await this.vendorModel.findByIdAndUpdate(existVendor._id, updatedVendorData, { new: true, upsert: true });

      // remove caching
      await this.redisCacheService.del('getAllVendor');
      await this.redisCacheService.del(`VendorInfo${existVendor._id}`);

      const result = {
        success: true,
        message: 'Update successfully',
        data: updatedVendor,
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  // ======== Delete Vendor by ID ========
  async deleteVendor(id: string) {
    try {
      const data = await this.vendorModel.findByIdAndDelete(id);

      if (!data) {
        throw new NotFoundException('Vendor not found');
      }

      // remove caching
      await this.redisCacheService.del('getAllVendor');
      await this.redisCacheService.del(`VendorInfo${data.slug}`);

      const result = {
        success: true,
        message: 'Vendor deleted successfully',
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  // =================================================//
  //                Vendor Following                  //
  // =================================================//

  async followUnfollow(userId: string, vendorId: string) {
    try {
      const existing = await this.vendorFollowModel.findOne({ user: userId, vendor: vendorId });

      if (existing) {
        // Remove follow record
        await this.vendorFollowModel.findByIdAndDelete(existing._id);

        // Remove vendor from user's following list
        await this.userModel.updateOne(
          { _id: userId },
          { $pull: { vendor_following: vendorId } }
        );

        return {
          success: true,
          message: 'Unfollowed successfully',
          data: { followed: false, vendor: vendorId, user: userId },
        };
      } else {
        // Create follow record
        await this.vendorFollowModel.create({ user: userId, vendor: vendorId });

        // Add vendor to user's following list
        await this.userModel.updateOne(
          { _id: userId },
          { $addToSet: { vendor_following: vendorId } }
        );

        return {
          success: true,
          message: 'Followed successfully',
          data: { followed: true, vendor: vendorId, user: userId },
        };
      }
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async isFollowing(userId: string, vendorId: string) {
    try {
      const follow = await this.vendorFollowModel.findOne({ user: userId, vendor: vendorId });

      const result = {
        success: true,
        message: 'Following result fetched successfully',
        data: { followed: !!follow },
      };

      return result;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }

  }

  async getFollowers(vendorId: string, req: any) {
    try {
      const { keyword, limit, page } = req.query;

      const perPage = limit ? parseInt(limit, 10) : 10;
      const currentPage = page ? parseInt(page, 10) : 1;
      const skip = (currentPage - 1) * perPage;

      // Base query
      const query = { vendor: vendorId };

      // Fetch followers with populated user
      const [followers, total] = await Promise.all([
        this.vendorFollowModel
          .find(query)
          .populate<{ user: User }>(
            "user",
            "first_name last_name avatar email username mobile"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),
        this.vendorFollowModel.countDocuments(query),
      ]);

      // Apply keyword filtering (in-memory, since it's on populated user fields)
      let filteredFollowers = followers;
      if (keyword) {
        const regex = new RegExp(keyword, "i");
        filteredFollowers = followers.filter((f) => {
          const u = f.user as User;
          return (
            regex.test(u?.first_name ?? "") ||
            regex.test(u?.last_name ?? "") ||
            regex.test(u?.mobile ?? "") ||
            regex.test(u?.email ?? "") ||
            regex.test(u?.username ?? "")
          );
        });
      }

      // Pagination details
      const totalPages = Math.ceil(total / perPage);
      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (currentPage < totalPages) {
        nextPage = currentPage + 1;
        nextUrl = `${req.originalUrl.split("?")[0]}?limit=${perPage}&page=${nextPage}`;
        if (keyword) nextUrl += `&keyword=${keyword}`;
      }

      return {
        success: true,
        message: "Fetched successfully",
        data: filteredFollowers,
        total,
        perPage,
        nextPage,
        nextUrl,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getFollowing(userId: string, req: any) {
    try {
      const { keyword, limit, page } = req.query;

      const perPage = limit ? parseInt(limit, 10) : 10;
      const currentPage = page ? parseInt(page, 10) : 1;
      const skip = (currentPage - 1) * perPage;

      // Base query
      const query = { user: userId };

      // Fetch following with populated vendor
      const [following, total] = await Promise.all([
        this.vendorFollowModel
          .find(query)
          .populate<{ vendor: Vendor }>("vendor", "name logo slug")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(perPage),
        this.vendorFollowModel.countDocuments(query),
      ]);

      // Apply keyword filtering (in-memory, since vendor is populated)
      let filteredFollowing = following;
      if (keyword) {
        const regex = new RegExp(keyword, "i");
        filteredFollowing = following.filter((f) => {
          const v = f.vendor as Vendor;
          return (
            regex.test(v?.name ?? "") ||
            regex.test(v?.slug ?? "")
          );
        });
      }

      // Pagination details
      const totalPages = Math.ceil(total / perPage);
      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (currentPage < totalPages) {
        nextPage = currentPage + 1;
        nextUrl = `${req.originalUrl.split("?")[0]}?limit=${perPage}&page=${nextPage}`;
        if (keyword) nextUrl += `&keyword=${keyword}`;
      }

      return {
        success: true,
        message: "Fetched successfully",
        data: filteredFollowing,
        total,
        perPage,
        nextPage,
        nextUrl,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

}
