import { IsString, IsOptional, IsInt, Min } from 'class-validator';

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

  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @IsInt()
  @Min(1900)
  @IsOptional()
  yearOfEstablishment?: number;
}
