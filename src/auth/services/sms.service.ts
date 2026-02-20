import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

@Injectable()
export class SmsService {
  private client: twilio.Twilio | null = null;
  private verifyServiceSid: string;

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID') || '';

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    }
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

  /**
   * Send OTP using Twilio Verify API
   * Twilio handles OTP generation automatically
   */
  async sendOTP(phoneNumber: string): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio SMS service not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.');
    }

    if (!this.verifyServiceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
    }

    // Normalize phone number to E.164 format
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
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
   */
  async verifyOTP(phoneNumber: string, code: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Twilio SMS service not configured');
    }

    if (!this.verifyServiceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
    }

    // Normalize phone number to E.164 format
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    try {
      const verificationCheck = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
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
