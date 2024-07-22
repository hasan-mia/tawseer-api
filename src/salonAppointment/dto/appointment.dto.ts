/* eslint-disable prettier/prettier */
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum AppointmentType {
  Pending = 'pending',
  Confirm = 'confirm',
  Ongoing = 'ongoing',
  Completed = 'completed',
}

export class AppointmentDto {

  @IsString()
  @IsNotEmpty()
  readonly user: string;

  @IsString()
  @IsNotEmpty()
  readonly service: string;

  @IsString()
  @IsNotEmpty()
  readonly salon: string;

  @IsString()
  @IsNotEmpty()
  readonly vendor: string;

  @IsString()
  @IsNotEmpty()
  readonly appointment_time: Date;

  @IsNotEmpty()
  @IsEnum(AppointmentType, {
    message: 'Type must be one of: pending, confirm, ongoing or completed',
  })
  readonly status: AppointmentType;

  @IsNumber()
  @IsNotEmpty()
  readonly price: number;

  @IsNumber()
  @IsOptional()
  readonly discount?: number;

}
