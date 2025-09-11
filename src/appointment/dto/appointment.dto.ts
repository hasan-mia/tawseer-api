/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum AppointmentType {
  Pending = 'pending',
  Confirm = 'confirm',
  Ongoing = 'ongoing',
  Completed = 'completed',
}
export enum PaymentType {
  cash_on = 'cash_on',
  stripe = 'stripe',
  paypal = 'paypal',
  bkash = 'bkash',
  nagad = 'nagad',
  paytm = 'paytm',
  bank_transfer = 'bank_transfer',
  wallet = 'wallet',
}

export class AppointmentDto {

  @IsString()
  @IsOptional()
  readonly user?: string;

  @IsString()
  @IsNotEmpty()
  readonly appointment_time: Date;

  @IsString()
  @IsNotEmpty()
  readonly payment_method: PaymentType;

  @IsNumber()
  @IsOptional()
  readonly discount?: number;

}
