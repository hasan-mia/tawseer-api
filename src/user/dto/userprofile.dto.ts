import {
  IsEmail,
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
}
