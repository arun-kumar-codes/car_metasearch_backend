import { IsEmail, IsString, MinLength } from 'class-validator';

export class SuperadminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
