import { Module } from '@nestjs/common';
import { AgencyOrchestratorService } from './services/agency-orchestrator.service';
import { NormalizationService } from './services/normalization.service';
import { DatabaseAgencyAdapter } from './adapters/database-agency.adapter';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [
    AgencyOrchestratorService,
    NormalizationService,
    DatabaseAgencyAdapter,
    PrismaService,
  ],
  exports: [
    AgencyOrchestratorService,
    NormalizationService,
  ],
})
export class AgenciesModule {}
