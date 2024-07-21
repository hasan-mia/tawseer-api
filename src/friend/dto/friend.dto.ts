/* eslint-disable prettier/prettier */
import { IsOptional, IsString } from 'class-validator';

export class FriendDto {
  @IsString()
  @IsOptional()
  readonly fromUser: string;

  @IsString()
  @IsOptional()
  readonly toUser: string;

  @IsString()
  @IsOptional()
  readonly status: string;
}
