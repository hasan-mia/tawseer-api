import { IsNotEmpty } from 'class-validator';

export class OtpDto {
  @IsNotEmpty()
  readonly mobile: string;

  @IsNotEmpty()
  readonly otp: number;
}
