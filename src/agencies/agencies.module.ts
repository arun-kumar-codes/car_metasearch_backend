import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { DatabaseAgencyAdapter } from './adapters/database-agency.adapter';
import { ClientApiAgencyAdapter } from './adapters/client-api-agency.adapter';
import { AgencyOrchestratorService } from './services/agency-orchestrator.service';
import { NormalizationService } from './services/normalization.service';
import { ApifyService } from './services/apify.service';
import { ApifySyncService } from './services/apify-sync.service';

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [
    DatabaseAgencyAdapter,
    ClientApiAgencyAdapter,
    AgencyOrchestratorService,
    NormalizationService,
    ApifyService,
    ApifySyncService,
  ],
  exports: [
    AgencyOrchestratorService,
    NormalizationService,
    ApifySyncService,
  ],
})
export class AgenciesModule {}
