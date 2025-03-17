import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';
export class ReviewDto {
  @IsMongoId()
  @IsOptional()
  readonly user?: string;

  @IsMongoId()
  @IsOptional()
  readonly vendor?: string;

  @IsMongoId()
  @IsOptional()
  readonly service?: string;

  @IsMongoId()
  @IsOptional()
  readonly product?: string;

  @IsEnum(['vendor', 'product', 'service'])
  readonly type: string;

  @IsNumber()
  readonly rating: number;

  @IsString()
  readonly message: string;
}

export class ReviewUpdateDto {
  @IsMongoId()
  @IsOptional()
  readonly user?: string;

  @IsMongoId()
  @IsOptional()
  readonly vendor?: string;

  @IsMongoId()
  @IsOptional()
  readonly service?: string;

  @IsMongoId()
  @IsOptional()
  readonly product?: string;

  @IsNumber()
  @IsOptional()
  readonly rating?: number;

  @IsString()
  @IsOptional()
  readonly message?: string;
}
