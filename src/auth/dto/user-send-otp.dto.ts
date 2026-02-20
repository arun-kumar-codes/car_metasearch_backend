import { IsString, Matches } from 'class-validator';

export class UserSendOtpDto {
  @IsString()
  @Matches(/^\+?[0-9]{10,14}$/, { message: 'Phone number must be valid (e.g. 9876543210 or +919876543210)' })
  phone: string;
}
