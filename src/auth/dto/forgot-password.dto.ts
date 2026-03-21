import { IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phone: string;
}
