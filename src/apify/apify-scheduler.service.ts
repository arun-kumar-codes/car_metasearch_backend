import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApifySyncService } from '../agencies/services/apify-sync.service';

@Injectable()
export class ApifySchedulerService {
  constructor(private apifySyncService: ApifySyncService) {}

  @Cron('0 */6 * * *')
  async handleSyncCron() {
    await this.apifySyncService.syncAll();
  }
}
