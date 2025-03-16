import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsMongoId()
  parentCategory?: string;

  @IsOptional()
  @IsString()
  image?: string;
}
