/* eslint-disable prettier/prettier */
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ReviewDto {

  @IsString()
  @IsOptional()
  readonly user?: string;

  @IsString()
  @IsOptional()
  readonly salon?: string;

  @IsString()
  @IsOptional()
  readonly service?: string;

  @IsString()
  @IsOptional()
  readonly type?: string;

  @IsNumber()
  @IsOptional()
  readonly rating?: number;

  @IsString()
  @IsOptional()
  readonly message?: string;

}
