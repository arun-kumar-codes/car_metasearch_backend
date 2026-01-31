import { IsString, IsEmail } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  otp: string;
}
