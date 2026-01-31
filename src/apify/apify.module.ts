import { Module } from '@nestjs/common';
import { ApifyController } from './apify.controller';
import { ApifySchedulerService } from './apify-scheduler.service';
import { AgenciesModule } from '../agencies/agencies.module';

@Module({
  imports: [AgenciesModule],
  controllers: [ApifyController],
  providers: [ApifySchedulerService],
})
export class ApifyModule {}
