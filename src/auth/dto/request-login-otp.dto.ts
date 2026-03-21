import { IsString, MinLength } from 'class-validator';

export class RequestLoginOtpDto {
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phone: string;
}
