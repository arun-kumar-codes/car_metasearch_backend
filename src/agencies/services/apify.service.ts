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

  async getLatestDatasetId(actorId: string): Promise<{ datasetId: string; finishedAt: Date } | null> {
    try {
      const runs = await this.client.actor(actorId).runs().list({ 
        limit: 1, 
        status: 'SUCCEEDED',
        desc: true 
      });
      if (runs.items.length === 0) return null;
      const lastRun = runs.items[0];
      const datasetId = lastRun.defaultDatasetId;
      if (!datasetId) return null;
      const finishedAt = lastRun.finishedAt ? new Date(lastRun.finishedAt) : (lastRun.startedAt ? new Date(lastRun.startedAt) : new Date());
      return { datasetId, finishedAt };
    } catch {
      return null;
    }
  }
}
