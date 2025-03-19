/* eslint-disable prettier/prettier */
import { IsOptional } from 'class-validator';

export class OtpDto {
  @IsOptional()
  readonly name?: string;

  @IsOptional()
  readonly email?: string;

  @IsOptional()
  readonly otp?: number;

  @IsOptional()
  readonly token?: string;

  @IsOptional()
  readonly password?: string;
}
