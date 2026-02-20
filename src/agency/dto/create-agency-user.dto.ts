import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class CreateAgencyUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['DEALER_ADMIN', 'DEALER_USER'])
  role?: 'DEALER_ADMIN' | 'DEALER_USER';
}
