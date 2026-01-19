import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  variant?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  minPrice?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  maxPrice?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  maxMileage?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  minMileage?: number;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  fuelType?: string;

  @IsString()
  @IsOptional()
  transmission?: string;

  @IsString()
  @IsOptional()
  bodyType?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  minYear?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
