/* eslint-disable prettier/prettier */
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class ServiceDto {

  @IsString()
  @IsOptional()
  readonly vendor?: string;

  @IsString()
  @IsOptional()
  readonly salon?: string;

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
