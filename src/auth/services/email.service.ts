import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }
  }

  async sendOTP(email: string, otp: string): Promise<void> {
    if (!this.transporter) return;
    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_USER'),
      to: email,
      subject: 'Verify your email - OTP',
      text: `Your OTP is: ${otp}. Valid for 10 minutes.`,
    });
  }

  async sendPasswordResetOTP(email: string, otp: string): Promise<void> {
    if (!this.transporter) return;
    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_USER'),
      to: email,
      subject: 'Password reset - OTP',
      text: `Your password reset OTP is: ${otp}. Valid for 10 minutes.`,
    });
  }
}
