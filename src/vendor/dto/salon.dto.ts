import {
  IsArray,
  IsOptional,
  IsPhoneNumber,
  IsString
} from 'class-validator';

export class SalonDto {
  @IsString()
  readonly name: string;

  @IsString()
  readonly logo: string;

  @IsString()
  readonly cover: string;

  @IsString()
  readonly address: string;

  @IsString()
  @IsOptional()
  readonly username?: string;

  @IsPhoneNumber()
  readonly mobile: string;

  @IsString()
  @IsOptional()
  readonly tin_certificate?: string;

  @IsArray()
  @IsOptional()
  readonly location?: string[];
}
