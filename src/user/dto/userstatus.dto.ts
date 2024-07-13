import { IsBoolean, IsOptional } from 'class-validator';

export class UserStatusDto {
  @IsBoolean()
  @IsOptional()
  readonly isVarified?: boolean;

  @IsBoolean()
  @IsOptional()
  readonly isBan?: boolean;

  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;
}
