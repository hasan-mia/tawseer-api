/* eslint-disable prettier/prettier */
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum PostType {
  Text = 'text',
  Photo = 'photo',
  Video = 'video',
}

export class PostDto {
  @IsOptional()
  @IsEnum(PostType, {
    message: 'Type must be one of: text, photo or video',
  })
  readonly type?: PostType;

  @IsString()
  @IsOptional()
  readonly text?: string;

  @IsString()
  @IsOptional()
  readonly photo?: string;

  @IsString()
  @IsOptional()
  readonly video?: string;

  @IsNumber()
  @IsOptional()
  readonly views?: number;

  @IsNumber()
  @IsOptional()
  readonly shares?: number;
}
