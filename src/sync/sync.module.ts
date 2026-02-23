import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { SyncController } from './sync.controller';

@Module({
  imports: [AgenciesModule],
  controllers: [SyncController],
})
export class SyncModule {}
