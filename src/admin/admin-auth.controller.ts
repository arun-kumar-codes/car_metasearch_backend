import { Body, Controller, Post } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { SuperadminSignupDto } from './dto/superadmin-signup.dto';
import { SuperadminLoginDto } from './dto/superadmin-login.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuthService: AdminAuthService) {}

  @Post('signup')
  async signup(@Body() dto: SuperadminSignupDto) {
    return this.adminAuthService.signup(dto);
  }

  @Post('login')
  async login(@Body() dto: SuperadminLoginDto) {
    return this.adminAuthService.login(dto);
  }
}

