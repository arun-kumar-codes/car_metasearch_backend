import { IsString, IsOptional, MinLength } from 'class-validator';

export class AutocompleteQueryDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  q?: string;

  @IsString()
  city: string;

  @IsString()
  @IsOptional()
  brand?: string;
}
