import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SuperadminSignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  secret?: string;
}
