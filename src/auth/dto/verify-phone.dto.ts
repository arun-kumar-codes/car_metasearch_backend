import { IsString, MinLength } from 'class-validator';

export class VerifyPhoneDto {
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phone: string;

  @IsString()
  otp: string;
}
