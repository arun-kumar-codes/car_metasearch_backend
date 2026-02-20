import { IsString, IsEmail, IsOptional, IsUrl, Matches } from 'class-validator';

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
  @Matches(/^\+?[1-9]\d{1,14}$/, { 
    message: 'WhatsApp number must be in E.164 format' 
  })
  whatsappNumber?: string;

  @IsUrl()
  @IsOptional()
  websiteUrl?: string;
}
