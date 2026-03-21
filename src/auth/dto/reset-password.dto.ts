import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phone: string;

  @IsString()
  otp: string;

  @IsString()
  @MinLength(6)
  password: string;
}
