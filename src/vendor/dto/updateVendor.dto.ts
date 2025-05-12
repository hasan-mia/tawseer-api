import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  ValidateNested
} from 'class-validator';

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export class LocationDto {
  @IsString()
  @IsOptional()
  readonly type?: string = 'Point';

  @IsArray()
  @IsOptional()
  readonly coordinates?: number[];
}

export class OpeningHoursPerDayDto {
  @IsEnum(DayOfWeek)
  @IsOptional()
  readonly day?: DayOfWeek;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Opens time must be in format HH:MM (24-hour format)'
  })
  readonly opens?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Closes time must be in format HH:MM (24-hour format)'
  })
  readonly closes?: string;

  @IsBoolean()
  @IsOptional()
  readonly isOpen?: boolean;
}

export class FacilityDto {
  @IsString()
  @IsOptional()
  readonly name?: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsString()
  @IsOptional()
  readonly icon?: string;
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

  @ValidateNested({ each: true })
  @Type(() => OpeningHoursPerDayDto)
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(7)
  readonly openingHours?: OpeningHoursPerDayDto[];

  @ValidateNested({ each: true })
  @Type(() => FacilityDto)
  @IsArray()
  @IsOptional()
  readonly facilities?: FacilityDto[];

  @IsNumber()
  @IsOptional()
  readonly rating?: number;

  @IsNumber()
  @IsOptional()
  readonly queue?: number;

  @IsNumber()
  @IsOptional()
  readonly total_review?: number;

  @IsBoolean()
  @IsOptional()
  readonly is_disabled?: boolean;

  @IsBoolean()
  @IsOptional()
  readonly is_deleted?: boolean;

}