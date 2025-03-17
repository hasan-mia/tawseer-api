/* eslint-disable prettier/prettier */
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class ServiceDto {

  @IsString()
  @IsOptional()
  readonly user?: string;

  @IsString()
  @IsOptional()
  readonly vendor?: string;

  @IsString()
  readonly name: string;

  @IsString()
  readonly description: string;

  @IsNumber()
  readonly price: number;

  @IsString()
  @IsOptional()
  readonly currency: string;

  @IsNumber()
  readonly duration: number;

  @IsString()
  readonly image: string;

  @IsString()
  @IsOptional()
  readonly country?: string;

  @IsBoolean()
  @IsOptional()
  readonly isDiscount?: boolean;

  @IsString()
  @IsOptional()
  readonly coupon?: string;

}

export class UpdateServiceDto {

  @IsString()
  @IsOptional()
  readonly name?: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsNumber()
  @IsOptional()
  readonly price?: number;

  @IsString()
  @IsOptional()
  readonly currency?: string;


  @IsNumber()
  @IsOptional()
  readonly duration?: number;


  @IsString()
  @IsOptional()
  readonly image?: string;

  @IsBoolean()
  @IsOptional()
  readonly isDiscount?: boolean;

  @IsString()
  @IsOptional()
  readonly coupon?: string;

}
