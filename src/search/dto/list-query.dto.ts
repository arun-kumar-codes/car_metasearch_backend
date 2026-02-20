import { IsString, IsOptional } from 'class-validator';

export class ListQueryDto {
  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  brand?: string;
}
