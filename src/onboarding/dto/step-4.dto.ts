import { IsString, IsOptional } from 'class-validator';

export class OnboardingStep4Dto {
  @IsString()
  bankName: string;

  @IsString()
  accountNumber: string;

  @IsString()
  ifscCode: string;

  @IsString()
  accountHolderName: string;
}
