import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsPhoneNumber,
  IsString,
  ValidateNested
} from 'class-validator';

export class LocationDto {
  @IsString()
  @IsOptional()
  readonly type?: string = 'Point';

  @IsArray()
  @IsOptional()
  readonly coordinates?: number[];
}

export class updateVendor {
  @IsString()
  @IsOptional()
  readonly name?: string;

  @IsString()
  @IsOptional()
  readonly bio?: string;

  @IsString()
  @IsOptional()
  readonly logo?: string;

  @IsString()
  @IsOptional()
  readonly cover?: string;

  @IsString()
  @IsOptional()
  readonly address?: string;

  @IsPhoneNumber()
  @IsOptional()
  readonly mobile?: string;

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
