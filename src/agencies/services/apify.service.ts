import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApifyClient } from 'apify-client';

@Injectable()
export class ApifyService {
  private client: ApifyClient;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('APIFY_TOKEN');
    this.client = new ApifyClient({ token: token || undefined });
  }

  async runActor(actorId: string, input?: Record<string, any>): Promise<{ defaultDatasetId: string }> {
    return this.client.actor(actorId).call(input || {});
  }

  async getDatasetItems(datasetId: string): Promise<any[]> {
    const { items } = await this.client.dataset(datasetId).listItems();
    return items;
  }
}
