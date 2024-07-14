import { IsOptional } from 'class-validator';

export class OtpDto {
  @IsOptional()
  readonly email?: string;

  @IsOptional()
  readonly otp?: number;
}
