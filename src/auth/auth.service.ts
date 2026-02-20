import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
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
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { Role } from './constants/roles';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  async signup(signupDto: SignupDto) {
    if (!signupDto.phone) {
      throw new BadRequestException('Phone number is required');
    }
    
    // Normalize phone number to ensure consistent format
    let normalizedPhone = signupDto.phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      // If no + prefix, add country code (default to India +91 for 10-digit numbers)
      if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
        normalizedPhone = `+91${normalizedPhone}`;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('9')) {
        // Philippines format
        normalizedPhone = `+63${normalizedPhone}`;
      } else {
        throw new BadRequestException('Phone number must include country code');
      }
    }
    
    const existing = await this.prisma.agency.findUnique({ where: { phone: normalizedPhone } });
    if (existing) {
      throw new BadRequestException('Phone number already registered');
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);

    const agency = await this.prisma.agency.create({
      data: {
        phone: normalizedPhone,
        password: hashedPassword,
        phoneVerified: false,
        role: Role.DEALER_ADMIN,
        name: 'Pending Onboarding',
        onboardingStatus: 'PENDING',
        approvalStatus: 'PENDING',
        isActive: false,
      },
      select: { id: true, phone: true, phoneVerified: true },
    });

    // Send OTP using Twilio Verify API (handles OTP generation automatically)
    await this.smsService.sendOTP(normalizedPhone);
    return { 
      message: 'Registration successful. OTP has been sent to your mobile number.', 
      agency: { id: agency.id, phone: agency.phone, phoneVerified: agency.phoneVerified }
    };
  }

  async login(loginDto: LoginDto) {
    if (!loginDto.phone) {
      throw new BadRequestException('Phone number is required');
    }
    
    // Normalize phone number
    let normalizedPhone = loginDto.phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
        normalizedPhone = `+91${normalizedPhone}`;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('9')) {
        normalizedPhone = `+63${normalizedPhone}`;
      }
    }
    
    const agency = await this.prisma.agency.findUnique({ where: { phone: normalizedPhone } });
    if (!agency) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!agency.phone || !agency.phoneVerified) {
      throw new UnauthorizedException('Please verify your mobile number first');
    }

    if (loginDto.otp) {
      // Verify OTP using Twilio Verify API
      const isValid = await this.smsService.verifyOTP(normalizedPhone, loginDto.otp);
      if (!isValid) {
        throw new UnauthorizedException('Invalid or expired OTP');
      }

      await this.prisma.agency.update({
        where: { id: agency.id },
        data: {
          lastLoginAt: new Date(),
          loginOtpToken: null,
          loginOtpExpires: null,
        },
      });
    } else if (loginDto.password) {
      if (!agency.password) {
        throw new UnauthorizedException('Password not set. Please use OTP login.');
      }

      const valid = await bcrypt.compare(loginDto.password, agency.password);
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      await this.prisma.agency.update({
        where: { id: agency.id },
        data: { lastLoginAt: new Date() },
      });
    } else {
      throw new BadRequestException('Either password or OTP is required');
    }

    const accessToken = this.jwtService.sign({
      sub: agency.id,
      phone: agency.phone,
      role: agency.role,
      agencyId: agency.id,
    });

    return {
      accessToken,
      agency: {
        id: agency.id,
        phone: agency.phone,
        name: agency.name,
        role: agency.role,
        approvalStatus: agency.approvalStatus,
        onboardingStatus: agency.onboardingStatus,
      },
    };
  }

  async agencyUserLogin(dto: AgencyUserLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const agencyUser = await this.prisma.agencyUser.findUnique({
      where: { email },
      include: { agency: { select: { id: true, name: true, approvalStatus: true, onboardingStatus: true, isActive: true } } },
    });
    if (!agencyUser) throw new UnauthorizedException('Invalid credentials');
    if (!agencyUser.agency.isActive) throw new UnauthorizedException('Organisation is inactive');
    const ok = await bcrypt.compare(dto.password, agencyUser.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.jwtService.sign({
      sub: agencyUser.id,
      role: agencyUser.role,
      agencyId: agencyUser.agencyId,
      type: 'agency_user',
    });

    return {
      accessToken,
      agency: {
        id: agencyUser.agency.id,
        name: agencyUser.agency.name,
        role: agencyUser.role,
        approvalStatus: agencyUser.agency.approvalStatus,
        onboardingStatus: agencyUser.agency.onboardingStatus,
      },
      user: {
        id: agencyUser.id,
        email: agencyUser.email,
        name: agencyUser.name,
        role: agencyUser.role,
      },
    };
  }

  async requestLoginOtp(dto: RequestLoginOtpDto) {
    // Normalize phone number
    let normalizedPhone = dto.phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
        normalizedPhone = `+91${normalizedPhone}`;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('9')) {
        normalizedPhone = `+63${normalizedPhone}`;
      }
    }
    
    const agency = await this.prisma.agency.findUnique({ where: { phone: normalizedPhone } });
    if (!agency) {
      throw new UnauthorizedException('Phone number not registered');
    }

    if (!agency.phoneVerified) {
      throw new UnauthorizedException('Please verify your mobile number first');
    }

    // Send OTP using Twilio Verify API (handles OTP generation automatically)
    await this.smsService.sendLoginOTP(normalizedPhone);
    return { message: 'Login OTP has been sent to your mobile number.' };
  }

  async verifyPhone(dto: VerifyPhoneDto) {
    // Normalize phone number to match the format stored during signup
    let normalizedPhone = dto.phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
        normalizedPhone = `+91${normalizedPhone}`;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('9')) {
        normalizedPhone = `+63${normalizedPhone}`;
      } else {
        throw new BadRequestException('Phone number format is invalid. Please use the same format as signup.');
      }
    }
    
    const agency = await this.prisma.agency.findUnique({ where: { phone: normalizedPhone } });
    if (!agency) {
      throw new BadRequestException('Agency not found. Please ensure you use the same phone number format as signup.');
    }

    if (agency.phoneVerified) {
      throw new BadRequestException('Phone number already verified');
    }

    // Verify OTP using Twilio Verify API (use normalized phone for Twilio)
    const isValid = await this.smsService.verifyOTP(normalizedPhone, dto.otp);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.agency.update({
      where: { id: agency.id },
      data: {
        phoneVerified: true,
        phoneOtpToken: null,
        phoneOtpExpires: null,
      },
    });

    return {
      message: 'Phone number verified successfully. Please complete onboarding.',
      agency: {
        id: agency.id,
        phone: agency.phone,
        phoneVerified: true,
      },
    };
  }

  async resendVerifyPhoneOtp(dto: ResendVerifyPhoneOtpDto) {
    if (!dto.phone) {
      throw new BadRequestException('Phone number is required');
    }

    // Normalize phone number to match the format stored during signup
    let normalizedPhone = dto.phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
        normalizedPhone = `+91${normalizedPhone}`;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('9')) {
        normalizedPhone = `+63${normalizedPhone}`;
      } else {
        throw new BadRequestException(
          'Phone number must include country code ',
        );
      }
    }

    const agency = await this.prisma.agency.findUnique({ where: { phone: normalizedPhone } });
    if (!agency) {
      throw new BadRequestException('Phone number not registered');
    }

    if (agency.phoneVerified) {
      throw new BadRequestException('Phone number already verified');
    }

    await this.smsService.sendOTP(normalizedPhone);
    return { message: 'OTP has been sent to your mobile number.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // Normalize phone number
    let normalizedPhone = dto.phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
        normalizedPhone = `+91${normalizedPhone}`;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('9')) {
        normalizedPhone = `+63${normalizedPhone}`;
      }
    }
    
    const agency = await this.prisma.agency.findUnique({ where: { phone: normalizedPhone } });
    if (!agency) {
      // Don't reveal if phone exists for security
      return { message: 'If the phone number exists, a reset OTP has been sent.' };
    }

    // Send OTP using Twilio Verify API (handles OTP generation automatically)
    // Note: We still store a placeholder token for tracking, but verification uses Twilio
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);
    await this.prisma.agency.update({
      where: { id: agency.id },
      data: { resetPasswordExpires: expires },
    });
    await this.smsService.sendOTP(normalizedPhone);
    return { message: 'If the phone number exists, a reset OTP has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Normalize phone number
    let normalizedPhone = dto.phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      if (normalizedPhone.length === 10 && /^[6-9]\d{9}$/.test(normalizedPhone)) {
        normalizedPhone = `+91${normalizedPhone}`;
      } else if (normalizedPhone.length === 10 && normalizedPhone.startsWith('9')) {
        normalizedPhone = `+63${normalizedPhone}`;
      }
    }
    
    const agency = await this.prisma.agency.findUnique({ where: { phone: normalizedPhone } });
    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    // Check if reset request is still valid (within expiry time)
    if (!agency.resetPasswordExpires || agency.resetPasswordExpires < new Date()) {
      throw new BadRequestException('OTP request expired. Please request a new OTP.');
    }

    // Verify OTP using Twilio Verify API
    const isValid = await this.smsService.verifyOTP(normalizedPhone, dto.otp);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    await this.prisma.agency.update({
      where: { id: agency.id },
      data: { password: hashed, resetPasswordToken: null, resetPasswordExpires: null },
    });
    return { message: 'Password reset successfully' };
  }

  private normalizeUserPhone(phone: string): string {
    let normalized = phone.trim();
    if (!normalized.startsWith('+')) {
      if (normalized.length === 10 && /^[6-9]\d{9}$/.test(normalized)) {
        normalized = `+91${normalized}`;
      } else if (normalized.length === 10 && normalized.startsWith('9')) {
        normalized = `+63${normalized}`;
      }
    }
    return normalized;
  }

  async userSendOtp(dto: UserSendOtpDto) {
    const normalizedPhone = this.normalizeUserPhone(dto.phone);
    await this.smsService.sendOTP(normalizedPhone);
    return { message: 'OTP has been sent to your mobile number.' };
  }

  async userVerifyOtp(dto: UserVerifyOtpDto) {
    const normalizedPhone = this.normalizeUserPhone(dto.phone);
    const isValid = await this.smsService.verifyOTP(normalizedPhone, dto.otp);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const existing = await this.prisma.user.findUnique({ where: { phone: normalizedPhone } });
    const user = existing
      ? await this.prisma.user.findUniqueOrThrow({
          where: { id: existing.id },
          select: { id: true, phone: true, name: true, email: true, suggestionsOptIn: true },
        })
      : await this.prisma.user.create({
          data: { phone: normalizedPhone },
          select: { id: true, phone: true, name: true, email: true, suggestionsOptIn: true },
        });
    const accessToken = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: Role.USER,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        suggestionsOptIn: user.suggestionsOptIn,
      },
    };
  }
}
