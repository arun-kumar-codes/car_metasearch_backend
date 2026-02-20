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
      if (agency.integrationType === 'APIFY') {
        return this.databaseAdapter.search(query, agency.id).catch((error) => ({
          agencyId: agency.id,
          agencyName: agency.name,
          listings: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: 0,
        } as AgencySearchResult));
      } else if (agency.integrationType === 'DIRECT') {
        // DIRECT agencies: Search DB only (manual listings)
        return this.databaseAdapter.search(query, agency.id).catch((error) => ({
          agencyId: agency.id,
          agencyName: agency.name,
          listings: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: 0,
        } as AgencySearchResult));
      } else {

        const [apiResult, dbResult] = await Promise.allSettled([
          this.clientApiAdapter.search(query, agency.id),
          this.databaseAdapter.search(query, agency.id),
        ]);

        const apiListings = apiResult.status === 'fulfilled' && apiResult.value.success
          ? apiResult.value.listings
          : [];

        const dbListings = dbResult.status === 'fulfilled' && dbResult.value.success
          ? dbResult.value.listings
          : [];

        const allListingsMap = new Map<string, RawAgencyListing>();
        [...apiListings, ...dbListings].forEach((listing) => {
          allListingsMap.set(listing.id, listing);
        });

        const mergedListings = Array.from(allListingsMap.values());

        return {
          agencyId: agency.id,
          agencyName: agency.name,
          listings: mergedListings,
          success: true,
          responseTime: Math.max(
            apiResult.status === 'fulfilled' ? apiResult.value.responseTime : 0,
            dbResult.status === 'fulfilled' ? dbResult.value.responseTime : 0,
          ),
        } as AgencySearchResult;
      }
    });

    const results = await Promise.all(searchPromises);
    return results;
  }
}
