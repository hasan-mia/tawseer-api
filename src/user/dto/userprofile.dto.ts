import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class UserProfileDto {
  @IsString()
  @IsOptional()
  readonly first_name?: string;

  @IsString()
  @IsOptional()
  readonly last_name?: string;

  @IsString()
  @IsOptional()
  readonly avatar?: string;

  @IsString()
  @IsOptional()
  readonly cover?: string;

  @IsEmail()
  @IsOptional()
  readonly email?: string;

  @IsString()
  @IsOptional()
  readonly username?: string;

  @IsPhoneNumber()
  @IsOptional()
  readonly mobile?: string;

  @IsStrongPassword({
    minLength: 6,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  @IsOptional()
  readonly password?: string;

  @IsString()
  @IsOptional()
  readonly bio?: string;

  @IsString()
  @IsOptional()
  readonly birth_date?: string;

  @IsString()
  @IsOptional()
  readonly role?: string;

  @IsString()
  @IsOptional()
  readonly subscribe_package?: string;

  @IsString()
  @IsOptional()
  readonly nid_front?: string;

  @IsString()
  @IsOptional()
  readonly nid_back?: string;

  @IsString()
  @IsOptional()
  readonly id_card_verification_status?: string;

  @IsString()
  @IsOptional()
  readonly fcmToken?: string;

  @IsArray()
  @IsOptional()
  readonly location?: string[];

  @IsString()
  @IsOptional()
  readonly parent?: string;

  @IsArray()
  @IsOptional()
  readonly children?: string[];

  @IsNumber()
  @IsOptional()
  readonly point?: number;

  @IsBoolean()
  @IsOptional()
  readonly is_verified?: boolean;

  @IsString()
  @IsOptional()
  readonly refresh_token?: string;

  @IsArray()
  @IsOptional()
  readonly friends?: string[];

  @IsArray()
  @IsOptional()
  readonly followers?: string[];

  @IsArray()
  @IsOptional()
  readonly followings?: string[];
}
