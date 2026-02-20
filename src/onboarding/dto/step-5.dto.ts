import { IsString, IsOptional, IsUrl } from 'class-validator';

export class OnboardingStep5Dto {
  @IsUrl()
  @IsOptional()
  apiUrl?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;
}
