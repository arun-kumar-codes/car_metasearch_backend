import { IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
