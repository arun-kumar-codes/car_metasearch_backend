import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsInt,
  IsArray,
  Min,
  ValidateNested,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApiSourceItemDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsUrl()
  apiUrl: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  businessType?: string;

  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @IsInt()
  @Min(1900)
  @IsOptional()
  yearOfEstablishment?: number;

  @IsString()
  @IsOptional()
  contactPersonName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  addressLine1?: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  pincode?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceAreas?: string[];

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  ifscCode?: string;

  @IsString()
  @IsOptional()
  accountHolderName?: string;

  @IsUrl()
  @IsOptional()
  apiUrl?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApiSourceItemDto)
  @IsOptional()
  apiSources?: ApiSourceItemDto[];
}
