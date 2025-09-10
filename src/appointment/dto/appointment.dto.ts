/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum AppointmentType {
  Pending = 'pending',
  Confirm = 'confirm',
  Ongoing = 'ongoing',
  Completed = 'completed',
}

export class AppointmentDto {

  @IsString()
  @IsOptional()
  readonly user?: string;

  @IsString()
  @IsNotEmpty()
  readonly appointment_time: Date;

  @IsNumber()
  @IsOptional()
  readonly discount?: number;

}
