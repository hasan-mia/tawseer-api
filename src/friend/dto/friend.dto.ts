/* eslint-disable prettier/prettier */
import { IsOptional, IsString } from 'class-validator';

export class FriendDto {
  @IsString()
  @IsOptional()
  readonly user?: string;

  @IsString()
  @IsOptional()
  readonly friend?: string;

  @IsString()
  @IsOptional()
  readonly status?: string;

  @IsString()
  @IsOptional()
  readonly friendId?: string;
}
