import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class StripePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
