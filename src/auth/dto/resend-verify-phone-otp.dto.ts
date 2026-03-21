import { IsString, MinLength } from 'class-validator';

export class ResendVerifyPhoneOtpDto {
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phone: string;
}

