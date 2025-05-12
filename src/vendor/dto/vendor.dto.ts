import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  ValidateNested
} from 'class-validator';

enum VendorType {
  SALON = 'salon',
  PARLOR = 'parlor',
  SHOP = 'shop',
}

enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

class LocationDto {
  @IsString()
  @IsOptional()
  readonly type?: string = 'Point';

  @IsArray()
  @IsOptional()
  readonly coordinates?: number[];
}

class OpeningHoursPerDayDto {
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  readonly day: DayOfWeek;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Opens time must be in format HH:MM (24-hour format)'
  })
  readonly opens: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Closes time must be in format HH:MM (24-hour format)'
  })
  readonly closes: string;

  @IsBoolean()
  @IsOptional()
  readonly isOpen?: boolean = true;
}

class FacilityDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsString()
  @IsOptional()
  readonly icon?: string;
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

  @ValidateNested({ each: true })
  @Type(() => OpeningHoursPerDayDto)
  @IsArray()
  @IsOptional()
  @ArrayMinSize(0)
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