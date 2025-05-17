import { RedisCacheService } from '@/rediscloud.service';
import { Product } from '@/schemas/product.schema';
import { User } from '@/schemas/user.schema';
import { Variant } from '@/schemas/variant.schema';
import { Vendor } from '@/schemas/vendor.schema';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/product.dto';

// Define interfaces for creating product with variants
interface VariantAttributes {
  attributes: Record<string, string>;
  price: number;
  stock: number;
  sku: string;
  isActive?: boolean;
}

export interface CreateProductWithVariantsDto extends CreateProductDto {
  variants: VariantAttributes[];
}

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Vendor.name)
    private vendorModel: Model<Vendor>,
    @InjectModel(Product.name)
    private productModel: Model<Product>,
    @InjectModel(Variant.name)
    private variantModel: Model<Variant>,
    private readonly redisCacheService: RedisCacheService
  ) { }

  // ======== Create Product with Variants ========
  async createProductWithVariants(userId: string, data: CreateProductWithVariantsDto) {
    const session = await this.productModel.db.startSession();
    session.startTransaction();

    try {
      // Check if user exists and is a vendor
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== 'vendor' && user.role !== 'admin') {
        throw new BadRequestException('Only vendors or admins can create products');
      }

      // Check if vendor profile exists
      const vendor = await this.vendorModel.findOne({ vendor: userId }).exec();
      if (!vendor && user.role === 'vendor') {
        throw new BadRequestException('Vendor profile not found. Please create a vendor profile first');
      }

      // Extract variants from data
      const { variants, ...productData } = data;

      // Create the product
      const productToSave = {
        ...productData,
        vendor: user.role === 'vendor' ? vendor._id : productData.vendor,
      };

      const newProduct = new this.productModel(productToSave);
      await newProduct.save({ session });

      // Create variants if provided
      if (variants && variants.length > 0) {
        const variantsToSave = variants.map(variant => ({
          ...variant,
          product: newProduct._id,
        }));

        await this.variantModel.insertMany(variantsToSave, { session });
      }

      await session.commitTransaction();
      session.endSession();

      // Clear cache
      await this.redisCacheService.del('getAllProducts');
      if (vendor) {
        await this.redisCacheService.del(`vendor_products_${vendor._id}`);
      }

      // Fetch the complete product with its variants
      const savedProduct = await this.productModel
        .findById(newProduct._id)
        .populate('category')
        .populate('vendor')
        .exec();

      const savedVariants = await this.variantModel
        .find({ product: newProduct._id })
        .exec();

      return {
        success: true,
        message: 'Product with variants created successfully',
        data: {
          product: savedProduct,
          variants: savedVariants,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Update Product with Variants ========
  async updateProductWithVariants(userId: string, productId: string, data: Partial<CreateProductWithVariantsDto>) {
    const session = await this.productModel.db.startSession();
    session.startTransaction();

    try {
      // Check if user exists and has permission
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Find the product
      const product = await this.productModel.findById(productId).exec();
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // Check if user has permission to update this product
      if (user.role === 'vendor') {
        const vendor = await this.vendorModel.findOne({ vendor: userId }).exec();
        if (!vendor || !product.vendor.equals(vendor._id as Types.ObjectId)) {
          throw new BadRequestException('You do not have permission to update this product');
        }
      } else if (user.role !== 'admin') {
        throw new BadRequestException('Only vendors or admins can update products');
      }

      // Extract variants from data
      const { variants, ...productData } = data;

      // Update product if there's data to update
      if (Object.keys(productData).length > 0) {
        await this.productModel.findByIdAndUpdate(
          productId,
          productData,
          { session, new: true }
        );
      }

      // Update or create variants if provided
      if (variants && variants.length > 0) {
        // Process each variant
        for (const variant of variants) {
          if ('_id' in variant) {
            // Update existing variant
            await this.variantModel.findByIdAndUpdate(
              variant._id,
              { ...variant, product: productId },
              { session, new: true }
            );
          } else {
            // Create new variant
            await this.variantModel.create(
              [{ ...variant, product: productId }],
              { session }
            );
          }
        }
      }

      await session.commitTransaction();
      session.endSession();

      // Clear cache
      await this.redisCacheService.del('getAllProducts');
      await this.redisCacheService.del(`product_with_variants_${productId}`);
      await this.redisCacheService.del(`product_with_variants_${product.slug}`);

      // Get updated product with variants
      const updatedProduct = await this.productModel
        .findById(productId)
        .populate('category')
        .populate('vendor')
        .exec();

      const updatedVariants = await this.variantModel
        .find({ product: productId })
        .exec();

      return {
        success: true,
        message: 'Product with variants updated successfully',
        data: {
          product: updatedProduct,
          variants: updatedVariants,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Get Product with Variants ========
  async getProductWithVariants(productIdOrSlug: string) {
    try {
      const cacheKey = `product_with_variants_${productIdOrSlug}`;
      const cacheData = await this.redisCacheService.get(cacheKey);

      // if (cacheData) {
      //   return cacheData;
      // }

      // Try to find by ID first, then by slug
      let product;
      if (Types.ObjectId.isValid(productIdOrSlug)) {
        product = await this.productModel
          .findById(productIdOrSlug)
          .populate('category')
          .populate('vendor')
          .exec();
      }

      // If not found by ID, try by slug
      if (!product) {
        product = await this.productModel
          .findOne({ slug: productIdOrSlug })
          .populate('category')
          .populate('vendor')
          .exec();
      }

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // Get all variants for this product
      const variants = await this.variantModel
        .find({ product: product._id })
        .exec();

      const result = {
        success: true,
        message: 'Product with variants fetched successfully',
        data: {
          product,
          variants,
        },
      };

      // Cache the result
      await this.redisCacheService.set(cacheKey, result, 60);

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Get All Products with Variants ========
  async getAllProductsWithVariants(req: any) {
    try {
      const cacheKey = `getAllProducts-${JSON.stringify(req.query)}`;
      let cacheData;

      try {
        cacheData = await this.redisCacheService.get(cacheKey);
      } catch (cacheError) {
        console.error("Error accessing cache:", cacheError);
      }

      // if (cacheData) {
      //   return cacheData;
      // }

      const { keyword, limit, page, sortBy, sortOrder } = req.query;

      let perPage: number | undefined;
      if (typeof limit === 'string') {
        perPage = parseInt(limit, 10);
      }

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const skip = perPage ? (currentPage - 1) * perPage : 0;

      const matchStage: any = {};
      if (keyword) {
        matchStage.name = { $regex: keyword, $options: 'i' };
      }

      // Build sort stage
      const sortStage: any = {};
      if (sortBy) {
        if (sortBy === 'price') {
          sortStage.price = sortOrder === 'desc' ? -1 : 1;
        } else if (sortBy === 'createdAt') {
          sortStage.createdAt = sortOrder === 'desc' ? -1 : 1;
        }
      } else {
        sortStage.createdAt = -1;
      }

      const count = await this.productModel.countDocuments(matchStage);
      const totalPages = perPage ? Math.ceil(count / perPage) : 1;

      // Aggregation pipeline to get products with variants
      const products = await this.productModel.aggregate([
        { $match: matchStage },
        { $sort: sortStage },
        { $skip: skip },
        ...(perPage ? [{ $limit: perPage }] : []),
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendor',
            foreignField: '_id',
            as: 'vendor'
          }
        },
        {
          $lookup: {
            from: 'variants',
            localField: '_id',
            foreignField: 'product',
            as: 'variants'
          }
        },
        {
          $addFields: {
            category: { $arrayElemAt: ['$category', 0] },
            vendor: { $arrayElemAt: ['$vendor', 0] }
          }
        },
        {
          $project: {
            __v: 0,
            'category.__v': 0,
            'vendor.__v': 0,
            'variants.__v': 0
          }
        }
      ]);

      // Build next page URL if applicable
      let nextPage: number | null = null;
      let nextUrl: string | null = null;

      if (perPage && currentPage < totalPages) {
        nextPage = currentPage + 1;
        nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
        if (keyword) {
          nextUrl += `&keyword=${keyword}`;
        }
        if (sortBy) {
          nextUrl += `&sortBy=${sortBy}&sortOrder=${sortOrder || 'asc'}`;
        }
      }

      const data = {
        success: true,
        data: products || [],
        total: count,
        perPage,
        currentPage,
        totalPages,
        nextPage,
        nextUrl,
      };

      // Cache the result
      await this.redisCacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Internal Server Error');
    }
  }

  // ======== Delete Vendor Products with Variants ========
  async deleteProductWithVariants(productId: string) {
    try {
      // Validate product ID format
      if (!Types.ObjectId.isValid(productId)) {
        throw new BadRequestException('Invalid product ID format');
      }

      const session = await this.productModel.db.startSession();

      try {
        session.startTransaction();

        const product = await this.productModel.findById(productId).session(session);

        if (!product) {
          throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        // Delete all variants associated with this product
        const deleteVariantsResult = await this.variantModel.deleteMany({
          product: new Types.ObjectId(productId)
        }).session(session);

        // Delete the product
        const deleteProductResult = await this.productModel.findByIdAndDelete(productId).session(session);

        await session.commitTransaction();

        // Clear cache
        // try {
        //   await this.redisCacheService.del(`getAllProducts`);
        //   await this.redisCacheService.del(`product:${productId}`);
        //   // Clear any other related cache keys
        //   const cacheKeys = await this.redisCacheService.keys('getAllProducts*');
        //   if (cacheKeys.length > 0) {
        //     await Promise.all(cacheKeys.map(key => this.redisCacheService.del(key)));
        //   }
        // } catch (cacheError) {
        //   console.error("Error clearing cache:", cacheError);
        //   // Continue execution even if cache clearing fails
        // }

        return {
          success: true,
          message: 'Product and all its variants deleted successfully',
          deletedProduct: deleteProductResult,
          deletedVariantsCount: deleteVariantsResult.deletedCount
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error.message || 'Failed to delete product and its variants'
      );
    }
  }


}