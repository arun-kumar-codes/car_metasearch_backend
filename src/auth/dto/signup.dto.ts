import { IsString, IsPhoneNumber, MinLength, Matches } from 'class-validator';

export class SignupDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { 
    message: 'Phone number must be in E.164 format. Include country code.' 
  })
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
