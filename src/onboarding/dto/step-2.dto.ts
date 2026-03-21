import { IsString, IsEmail, IsOptional, IsUrl } from 'class-validator';

export class OnboardingStep2Dto {
  @IsString()
  @IsOptional()
  contactPersonName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  contactEmail: string; // REQUIRED for onboarding

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @IsUrl()
  @IsOptional()
  websiteUrl?: string;
}
