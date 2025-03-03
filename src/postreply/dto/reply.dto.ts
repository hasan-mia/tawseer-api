/* eslint-disable prettier/prettier */
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReplyDto {
  // @IsString()
  // @IsNotEmpty()
  // readonly user: string;

  // @IsString()
  // @IsNotEmpty()
  // readonly post: string;

  // @IsString()
  // @IsNotEmpty()
  // readonly comment: string;

  @IsString()
  @IsOptional()
  readonly text: string;

  @IsString()
  @IsOptional()
  readonly image: string;

  @IsBoolean()
  @IsOptional()
  readonly is_deleted?: boolean;
}
