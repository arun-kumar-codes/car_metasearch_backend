import { Controller, Post, Body } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post()
  async handle(@Body() payload: any) {
    return this.webhookService.handleWebhook(payload);
  }
}
