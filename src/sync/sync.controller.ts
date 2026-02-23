import { Controller, Post } from '@nestjs/common';
import { ApiSyncService } from '../agencies/services/api-sync.service';

/**
 * Manual trigger for metasearch data sync.
 * API agencies are also synced on a schedule (see ApiSyncService runScheduledSync).
 */
@Controller('sync')
export class SyncController {
  constructor(private readonly apiSyncService: ApiSyncService) {}

  @Post('api')
  async syncApi() {
    return this.apiSyncService.syncAll();
  }
}
