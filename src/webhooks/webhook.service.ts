import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookService {
  async handleWebhook(payload: any): Promise<{ received: boolean }> {
    return { received: true };
  }
}
