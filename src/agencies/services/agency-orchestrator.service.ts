import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DatabaseAgencyAdapter } from '../adapters/database-agency.adapter';
import { ClientApiAgencyAdapter } from '../adapters/client-api-agency.adapter';
import { AgencySearchResult, RawAgencyListing } from '../interfaces/agency-adapter.interface';
import { SearchQueryDto } from '../../search/dto/search-query.dto';

@Injectable()
export class AgencyOrchestratorService {
  constructor(
    private prisma: PrismaService,
    private databaseAdapter: DatabaseAgencyAdapter,
    private clientApiAdapter: ClientApiAgencyAdapter,
  ) {}

  async searchAllAgencies(query: SearchQueryDto): Promise<AgencySearchResult[]> {
    const activeAgencies = await this.prisma.agency.findMany({
      where: { 
        approvalStatus: 'APPROVED',
      },
      select: { id: true, name: true, integrationType: true },
    });

    const searchPromises = activeAgencies.map(async (agency) => {
      // APIFY, API, and DIRECT all serve from DB only (sync keeps data up to date)
      if (agency.integrationType === 'APIFY' || agency.integrationType === 'API' || agency.integrationType === 'DIRECT') {
        return this.databaseAdapter.search(query, agency.id).catch((error) => ({
          agencyId: agency.id,
          agencyName: agency.name,
          listings: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: 0,
        } as AgencySearchResult));
      }

      // Fallback for any other type: DB only
      return this.databaseAdapter.search(query, agency.id).catch((error) => ({
        agencyId: agency.id,
        agencyName: agency.name,
        listings: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: 0,
      } as AgencySearchResult));
    });

    const results = await Promise.all(searchPromises);
    return results;
  }
}
