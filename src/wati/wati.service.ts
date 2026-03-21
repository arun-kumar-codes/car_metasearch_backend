import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/** WATI WhatsApp template: new_user_1 - Hello {{1}}, Search multiple sources... */
const TEMPLATE_NEW_USER_WELCOME = 'new_user_1';
const BROADCAST_NAME_WELCOME = 'caratlas_user_welcome';

@Injectable()
export class WatiService {
  private readonly logger = new Logger(WatiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly channelNumber: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('WATI_BASE_URL') || '').replace(/\/$/, '');
    this.apiKey = this.configService.get<string>('WATI_API_KEY') || '';
    this.channelNumber = this.configService.get<string>('WATI_CHANNEL_NUMBER') || '';
    this.enabled = Boolean(this.baseUrl && this.apiKey && this.channelNumber);
    if (!this.enabled && (this.baseUrl || this.apiKey)) {
      this.logger.warn('WATI partially configured; welcome WhatsApp will be skipped. Set WATI_BASE_URL, WATI_API_KEY, WATI_CHANNEL_NUMBER.');
    }
  }

  /**
   * Send new-user welcome template to a user's WhatsApp (first login).
   * Template new_user_1: "Hello {{1}}, Search multiple sources..."
   * {{1}} = user's name (or fallback).
   */
  async sendNewUserWelcome(phone: string, name: string | null): Promise<boolean> {
    if (!this.enabled) return false;
    const recipient = this.toE164(phone);
    const displayName = (name && name.trim()) ? name.trim() : 'there';
    try {
      const url = `${this.baseUrl}/api/v2/sendTemplateMessage`;
      const res = await axios.post(
        url,
        {
          template_name: TEMPLATE_NEW_USER_WELCOME,
          broadcast_name: BROADCAST_NAME_WELCOME,
          channel_number: this.channelNumber,
          parameters: [{ name: '1', value: displayName }],
        },
        {
          params: { whatsappNumber: recipient },
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
      if (res.data?.result === true) {
        this.logger.log(`WATI welcome sent to ${recipient}`);
        return true;
      }
      this.logger.warn(`WATI welcome response: ${JSON.stringify(res.data)}`);
      return false;
    } catch (err: any) {
      this.logger.error(`WATI send welcome failed for ${recipient}: ${err?.response?.data?.message || err?.message}`);
      return false;
    }
  }

  /** Normalize phone to E.164 digits only (no +) for WATI. */
  private toE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
    if (digits.startsWith('91') && digits.length === 12) return digits;
    return digits || phone;
  }
}
