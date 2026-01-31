import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from './services/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async signup(signupDto: SignupDto) {
    const existing = await this.prisma.agency.findUnique({ where: { email: signupDto.email } });
    if (existing) throw new BadRequestException('Email already registered');
    const existingGst = await this.prisma.agency.findUnique({ where: { gstNumber: signupDto.gstNumber } });
    if (existingGst) throw new BadRequestException('GST number already registered');

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);

    const agency = await this.prisma.agency.create({
      data: {
        email: signupDto.email,
        password: hashedPassword,
        name: signupDto.name,
        gstNumber: signupDto.gstNumber,
        emailVerificationToken: otp,
        emailVerificationExpires: expires,
      },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    await this.emailService.sendOTP(signupDto.email, otp);
    return { message: 'Registration successful. OTP has been sent to your email.', agency };
  }

  async login(loginDto: LoginDto) {
    const agency = await this.prisma.agency.findUnique({ where: { email: loginDto.email } });
    if (!agency || !agency.password) throw new UnauthorizedException('Invalid credentials');
    if (!agency.emailVerified) throw new UnauthorizedException('Please verify your email first');

    const valid = await bcrypt.compare(loginDto.password, agency.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.agency.update({
      where: { id: agency.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.jwtService.sign({ sub: agency.id, email: agency.email });
    return {
      accessToken,
      agency: { id: agency.id, email: agency.email, name: agency.name },
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const agency = await this.prisma.agency.findUnique({ where: { email: dto.email } });
    if (!agency) throw new BadRequestException('Agency not found');
    if (agency.emailVerified) throw new BadRequestException('Email already verified');
    if (
      agency.emailVerificationToken !== dto.otp ||
      !agency.emailVerificationExpires ||
      agency.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.agency.update({
      where: { id: agency.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    });
    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const agency = await this.prisma.agency.findUnique({ where: { email: dto.email } });
    if (!agency) return { message: 'If the email exists, a reset OTP has been sent.' };

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);
    await this.prisma.agency.update({
      where: { id: agency.id },
      data: { resetPasswordToken: otp, resetPasswordExpires: expires },
    });
    await this.emailService.sendPasswordResetOTP(dto.email, otp);
    return { message: 'If the email exists, a reset OTP has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const agency = await this.prisma.agency.findUnique({ where: { email: dto.email } });
    if (!agency) throw new BadRequestException('Agency not found');
    if (
      agency.resetPasswordToken !== dto.otp ||
      !agency.resetPasswordExpires ||
      agency.resetPasswordExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    await this.prisma.agency.update({
      where: { id: agency.id },
      data: { password: hashed, resetPasswordToken: null, resetPasswordExpires: null },
    });
    return { message: 'Password reset successfully' };
  }
}
