import { IsString, IsOptional } from 'class-validator';

export class OnboardingStep1Dto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  businessType?: string;

  @IsString()
  gstNumber: string;

  @IsString()
  @IsOptional()
  panNumber?: string;
}
