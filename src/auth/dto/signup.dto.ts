import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
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
}
