/* eslint-disable prettier/prettier */
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export enum CouponType {
  Percentage = 'percentage',
  Amount = 'amount'
}

export class CouponDto {

  @IsString()
  @IsNotEmpty()
  readonly user: string;

  @IsString()
  @IsNotEmpty()
  readonly salon: string;

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

  @IsDate()
  @IsNotEmpty()
  readonly expiredAt: Date;

}
