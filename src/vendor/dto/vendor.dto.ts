import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  ValidateNested
} from 'class-validator';

enum VendorType {
  SALON = 'salon',
  PARLOR = 'parlor',
  PRODUCT = 'product',
}

class LocationDto {
  @IsString()
  @IsOptional()
  readonly type?: string = 'Point';

  @IsArray()
  @IsOptional()
  readonly coordinates?: number[];
}

export class VendorDto {
  @IsString()
  readonly name: string;

  @IsString()
  readonly bio: string;

  @IsString()
  readonly logo: string;

  @IsString()
  readonly cover: string;

  @IsEnum(VendorType)
  readonly type: VendorType;

  @IsString()
  readonly address: string;

  @IsPhoneNumber()
  readonly mobile: string;

  @IsString()
  @IsOptional()
  readonly tin_certificate?: string;

  @IsBoolean()
  @IsOptional()
  readonly is_verified?: boolean;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  readonly location?: LocationDto;

  @IsBoolean()
  @IsOptional()
  readonly is_deleted?: boolean;

  @IsBoolean()
  @IsOptional()
  readonly is_disabled?: boolean;
}
