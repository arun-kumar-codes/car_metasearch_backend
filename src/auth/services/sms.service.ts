import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import axios from 'axios';

@Injectable()
export class SmsService {
  private client: twilio.Twilio | null = null;
  private verifyServiceSid: string;
  private provider: 'twilio' | 'msg91';

  private msg91AuthKey: string;
  private msg91TemplateId: string;
  private msg91OtpExpiryMinutes: number;
  private msg91OtpLength?: number;

  constructor(private configService: ConfigService) {
    this.provider =
      (this.configService.get<string>('SMS_PROVIDER')?.toLowerCase() as
        | 'twilio'
        | 'msg91'
        | undefined) || 'twilio';

    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID') || '';

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    }

    this.msg91AuthKey = this.configService.get<string>('MSG91_AUTH_KEY') || '';
    this.msg91TemplateId = this.configService.get<string>('MSG91_TEMPLATE_ID') || '';
    this.msg91OtpExpiryMinutes = Number(this.configService.get<string>('MSG91_OTP_EXPIRY_MINUTES') || 10);
    const otpLengthRaw = this.configService.get<string>('MSG91_OTP_LENGTH');
    const parsedLength = otpLengthRaw ? Number(otpLengthRaw) : undefined;
    this.msg91OtpLength = Number.isFinite(parsedLength) ? parsedLength : undefined;
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it already starts with +, return as is (assuming it's already in E.164)
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // If it starts with 0, remove the leading 0 (common in some countries)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Common country code mappings (you can expand this)
    // India: +91 (10 digits after country code)
    if (cleaned.length === 10 && cleaned.match(/^[6-9]\d{9}$/)) {
      return `+91${cleaned}`;
    }
    
    // Philippines: +63 (10 digits after country code, mobile numbers start with 9)
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      return `+63${cleaned}`;
    }
    
    // If it's 11 digits and starts with 1, assume US/Canada (+1)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    // If it's 10 digits, default to India (+91) - adjust based on your primary market
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    
    // If no pattern matches, try to add + and return
    // This will fail Twilio validation, but at least we tried
    return `+${cleaned}`;
  }

  private toMsg91Mobile(phoneNumber: string): string {
    // MSG91 expects digits only, including country code (e.g. 919876543210)
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return normalized.replace(/[^\d]/g, '');
  }

  private assertMsg91Configured() {
    if (!this.msg91AuthKey) {
      throw new Error('MSG91 not configured. Please set MSG91_AUTH_KEY in environment variables.');
    }
    if (!this.msg91TemplateId) {
      throw new Error('MSG91 not configured. Please set MSG91_TEMPLATE_ID in environment variables.');
    }
  }

  /**
   * Send OTP using Twilio Verify API
   * Twilio handles OTP generation automatically
   */
  async sendOTP(phoneNumber: string): Promise<void> {
    if (this.provider === 'msg91') {
      this.assertMsg91Configured();
      const mobile = this.toMsg91Mobile(phoneNumber);

      try {
        const res = await axios.get('https://control.msg91.com/api/v5/otp', {
          params: {
            template_id: this.msg91TemplateId,
            mobile,
            otp_expiry: this.msg91OtpExpiryMinutes,
            ...(this.msg91OtpLength ? { otp_length: this.msg91OtpLength } : {}),
          },
          headers: {
            authkey: this.msg91AuthKey,
          },
          timeout: 15000,
        });

        // MSG91 typically returns { type: 'success'|'error', message: '...' }
        if (res?.data?.type && String(res.data.type).toLowerCase() !== 'success') {
          throw new Error(res.data.message || 'MSG91 send OTP failed');
        }
        return;
      } catch (error: any) {
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'Unknown MSG91 error';
        console.error('MSG91 OTP Error:', error?.response?.data || error);
        throw new Error(`Failed to send OTP: ${msg}`);
      }
    }

    // Default / fallback: Twilio Verify
    if (!this.client) {
      throw new Error(
        'Twilio SMS service not configured. Set SMS_PROVIDER=msg91 or configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      );
    }

    if (!this.verifyServiceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
    }

    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      await this.client.verify.v2.services(this.verifyServiceSid).verifications.create({
        to: normalizedPhone,
        channel: 'sms',
      });
    } catch (error: any) {
      console.error('Twilio Verify Error:', error);
      throw new Error(`Failed to send OTP: ${error.message}`);
    }
  }

  /**
   * Verify OTP using Twilio Verify API
   * Returns true if OTP is valid, false otherwise
   *
   * If DEV_OTP is set in env, entering that exact code (trimmed) accepts any phone OTP
   * (user login, dealer login, verify-phone, reset-password). Remove DEV_OTP in production.
   */
  async verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
    const devOtp = this.configService.get<string>('DEV_OTP')?.trim();
    if (devOtp && code?.trim() === devOtp) {
      return true;
    }

    if (this.provider === 'msg91') {
      this.assertMsg91Configured();
      const mobile = this.toMsg91Mobile(phoneNumber);

      try {
        const res = await axios.get('https://control.msg91.com/api/v5/otp/verify', {
          params: { mobile, otp: code },
          headers: { authkey: this.msg91AuthKey },
          timeout: 15000,
        });

        if (res?.data?.type) {
          return String(res.data.type).toLowerCase() === 'success';
        }

        // Some variants return { message: 'OTP verified success' }
        const message = String(res?.data?.message || '').toLowerCase();
        if (message.includes('success')) return true;
        return false;
      } catch (error: any) {
        console.error('MSG91 OTP Verify Error:', error?.response?.data || error);
        return false;
      }
    }

    if (!this.client) {
      throw new Error('Twilio SMS service not configured');
    }

    if (!this.verifyServiceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
    }

    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      const verificationCheck = await this.client.verify.v2.services(this.verifyServiceSid).verificationChecks.create({
        to: normalizedPhone,
        code: code,
      });

      return verificationCheck.status === 'approved';
    } catch (error: any) {
      console.error('Twilio Verify Check Error:', error);
      return false;
    }
  }

  /**
   * Send login OTP (same as sendOTP, kept for backward compatibility)
   */
  async sendLoginOTP(phoneNumber: string): Promise<void> {
    return this.sendOTP(phoneNumber);
  }
}
