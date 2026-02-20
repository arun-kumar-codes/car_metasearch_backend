import { IsString, Length, Matches } from 'class-validator';

export class UserVerifyOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{10,14}$/, { message: 'Phone number must be valid' })
  phone: string;

  @IsString()
  @Length(4, 8, { message: 'OTP must be 4-8 digits' })
  otp: string;
}
