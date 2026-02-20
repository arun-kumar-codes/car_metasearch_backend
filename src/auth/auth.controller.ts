import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { RequestLoginOtpDto } from './dto/request-login-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserSendOtpDto } from './dto/user-send-otp.dto';
import { UserVerifyOtpDto } from './dto/user-verify-otp.dto';
import { ResendVerifyPhoneOtpDto } from './dto/resend-verify-phone-otp.dto';
import { AgencyUserLoginDto } from './dto/agency-user-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('agency-user/login')
  async agencyUserLogin(@Body() dto: AgencyUserLoginDto) {
    return this.authService.agencyUserLogin(dto);
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('request-login-otp')
  async requestLoginOtp(@Body() dto: RequestLoginOtpDto) {
    return this.authService.requestLoginOtp(dto);
  }

  @Post('verify-phone')
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(dto);
  }

  @Post('resend-verify-phone-otp')
  async resendVerifyPhoneOtp(@Body() dto: ResendVerifyPhoneOtpDto) {
    return this.authService.resendVerifyPhoneOtp(dto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('user/send-otp')
  async userSendOtp(@Body() dto: UserSendOtpDto) {
    return this.authService.userSendOtp(dto);
  }

  @Post('user/verify-otp')
  async userVerifyOtp(@Body() dto: UserVerifyOtpDto) {
    return this.authService.userVerifyOtp(dto);
  }
}
