import { IsString, IsInt, IsOptional, IsNumber, IsBoolean, IsUrl, Min, IsArray } from 'class-validator';

export class CreateListingDto {
  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsString()
  @IsOptional()
  variant?: string;

  @IsInt()
  @Min(1900)
  year: number;

  @IsInt()
  @Min(0)
  mileage: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  fuelType?: string;

  @IsString()
  @IsOptional()
  transmission?: string;

  @IsString()
  @IsOptional()
  bodyType?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsUrl()
  @IsOptional()
  externalUrl?: string;

  @IsString()
  @IsOptional()
  ownership?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  images?: string[];
}
