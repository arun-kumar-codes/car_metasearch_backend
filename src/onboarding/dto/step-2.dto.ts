import { IsString, IsEmail, IsOptional, IsUrl } from 'class-validator';

export class OnboardingStep2Dto {
  @IsString()
  @IsOptional()
  contactPersonName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsUrl()
  @IsOptional()
  websiteUrl?: string;
}
