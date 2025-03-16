import { IsBoolean, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Types } from 'mongoose';

export enum ProductStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsMongoId()
  @IsNotEmpty()
  category: Types.ObjectId;

  @IsMongoId()
  @IsOptional()
  vendor?: Types.ObjectId;

  @IsEnum(ProductStatus)
  @IsNotEmpty()
  status: ProductStatus = ProductStatus.DRAFT;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsMongoId()
  @IsOptional()
  category?: Types.ObjectId;

  @IsMongoId()
  @IsOptional()
  vendor?: Types.ObjectId;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;
}

export class CreateVariantDto {
  @IsMongoId()
  @IsNotEmpty()
  product: Types.ObjectId;

  @IsObject()
  @IsNotEmpty()
  attributes: Record<string, string>;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  stock: number;

  @IsBoolean()
  @IsOptional()
  isActive: boolean = true;

  @IsString()
  @IsNotEmpty()
  sku: string;
}

export class UpdateVariantDto {
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string>;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  sku?: string;
}