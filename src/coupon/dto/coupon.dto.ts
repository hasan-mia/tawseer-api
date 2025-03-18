import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum CouponType {
  Percentage = 'percentage',
  Amount = 'amount'
}

export class CouponDto {
  @IsString()
  @IsNotEmpty()
  readonly code: string;

  @IsEnum(CouponType, {
    message: 'Type must be one of: percentage or amount',
  })
  @IsNotEmpty()
  readonly type: CouponType;

  @IsNumber()
  @IsNotEmpty()
  readonly discount: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly expiredAt?: Date;
}

export class CouponUpdateDto {
  @IsString()
  @IsOptional()
  readonly code: string;

  @IsEnum(CouponType, {
    message: 'Type must be one of: percentage or amount',
  })
  @IsOptional()
  readonly type?: CouponType;

  @IsNumber()
  @IsOptional()
  readonly discount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  readonly expiredAt?: Date;
}
