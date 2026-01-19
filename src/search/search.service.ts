import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto, ListingResponseDto } from './dto/listing-response.dto';
import { AgencyOrchestratorService } from '../agencies/services/agency-orchestrator.service';
import { NormalizationService } from '../agencies/services/normalization.service';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private agencyOrchestrator: AgencyOrchestratorService,
    private normalizationService: NormalizationService,
  ) {}

  async search(query: SearchQueryDto): Promise<SearchResponseDto> {
    const { page = 1, limit = 20 } = query;

    const agencyResults = await this.agencyOrchestrator.searchAllAgencies(query);

    const allListings: ListingResponseDto[] = [];

    for (const result of agencyResults) {
      if (result.success) {
        const normalized = this.normalizationService.normalizeMany(
          result.listings,
          result.agencyName,
        );
        allListings.push(...normalized);
      }
    }

    allListings.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      return b.year - a.year;
    });

    const total = allListings.length;
    const skip = (page - 1) * limit;
    const paginatedListings = allListings.slice(skip, skip + limit);

    return {
      listings: paginatedListings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBrands(): Promise<string[]> {
    const brands = await this.prisma.listing.findMany({
      select: {
        brand: true,
      },
      distinct: ['brand'],
      orderBy: {
        brand: 'asc',
      },
    });

    return brands.map((b) => b.brand);
  }

  async getModels(brand?: string): Promise<string[]> {
    const where = brand ? { brand } : {};
    const models = await this.prisma.listing.findMany({
      where,
      select: {
        model: true,
      },
      distinct: ['model'],
      orderBy: {
        model: 'asc',
      },
    });

    return models.map((m) => m.model);
  }
}
