import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class SignUpDto {
  @IsNotEmpty()
  @IsPhoneNumber()
  readonly mobile: string;
}
