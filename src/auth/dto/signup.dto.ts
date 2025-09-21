/* eslint-disable prettier/prettier */
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export enum UserRole {
  User = 'user',
  Vendor = 'vendor',
  Editor = 'editor',
  Admin = 'admin',
  SuperAdmin = 'super_admin',
}

export class SignUpDto {
  @IsNotEmpty()
  @IsString()
  readonly first_name: string;

  @IsNotEmpty()
  @IsString()
  readonly last_name: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Please enter valid email' })
  readonly email: string;

  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 6,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  @IsNotEmpty()
  readonly password?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'Role must be one of: user, vendor, editor, admin, super_admin',
  })
  readonly role?: UserRole;

  @IsOptional()
  @IsString()
  readonly birth_date?: string;

  @IsOptional()
  @IsString()
  readonly fcmToken?: string;
}
