import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto, ListingResponseDto } from './dto/listing-response.dto';
import { AgencyOrchestratorService } from '../agencies/services/agency-orchestrator.service';
import { NormalizationService } from '../agencies/services/normalization.service';
import { ClicksService } from '../clicks/clicks.service';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private agencyOrchestrator: AgencyOrchestratorService,
    private normalizationService: NormalizationService,
    private clicksService: ClicksService,
  ) {}

  async search(query: SearchQueryDto): Promise<SearchResponseDto> {
    const { page = 1, limit = 50, sortBy = 'price_asc' } = query;
    const agencyResults = await this.agencyOrchestrator.searchAllAgencies(query);
    const allListings: ListingResponseDto[] = [];

    for (const result of agencyResults) {
      if (result.success) {
        const normalized = this.normalizationService.normalizeMany(result.listings, result.agencyName);
        const agency = await this.prisma.agency.findUnique({
          where: { id: result.agencyId },
          select: { cpc: true, integrationType: true },
        });
        const listingIds = normalized.map((l) => l.id);
        const clickCounts = await this.getClickCountsForListings(listingIds);
        normalized.forEach((listing) => {
          const baseUrl = `${process.env.API_BASE_URL || 'http://localhost:3377'}/click/${listing.id}`;
          if (agency?.integrationType !== 'APIFY' && listing.externalUrl) {
            const params = new URLSearchParams({ url: listing.externalUrl, agencyId: result.agencyId });
            listing.trackingUrl = `${baseUrl}?${params.toString()}`;
          } else {
            listing.trackingUrl = baseUrl;
          }
          listing.clickCount = clickCounts[listing.id] || 0;
          listing.agency.cpc = agency?.cpc || 0;
        });
        allListings.push(...normalized);
      }
    }

    allListings.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.price !== b.price ? a.price - b.price : b.year - a.year;
        case 'price_desc':
          return a.price !== b.price ? b.price - a.price : b.year - a.year;
        case 'year_desc':
          return a.year !== b.year ? b.year - a.year : a.price - b.price;
        case 'year_asc':
          return a.year !== b.year ? a.year - b.year : a.price - b.price;
        case 'mileage_asc':
          return a.mileage !== b.mileage ? a.mileage - b.mileage : a.price - b.price;
        case 'mileage_desc':
          return a.mileage !== b.mileage ? b.mileage - a.mileage : a.price - b.price;
        default:
          return a.price !== b.price ? a.price - b.price : b.year - a.year;
      }
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

  async getById(id: string): Promise<ListingResponseDto | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { agency: { select: { id: true, name: true, cpc: true } } },
    });
    if (!listing) return null;
    const rawListing = {
      id: listing.id,
      agencyId: listing.agencyId,
      brand: listing.brand,
      model: listing.model,
      variant: listing.variant ?? undefined,
      year: listing.year,
      mileage: listing.mileage,
      price: listing.price,
      currency: listing.currency,
      color: listing.color ?? undefined,
      fuelType: listing.fuelType ?? undefined,
      transmission: listing.transmission ?? undefined,
      bodyType: listing.bodyType ?? undefined,
      city: listing.city ?? undefined,
      state: listing.state ?? undefined,
      country: listing.country ?? undefined,
      isAvailable: listing.isAvailable,
      externalUrl: listing.externalUrl ?? undefined,
      ownership: listing.ownership ?? undefined,
    };
    const normalized = this.normalizationService.normalize(rawListing);
    normalized.agency.name = listing.agency.name;
    normalized.agency.cpc = listing.agency.cpc || 0;
    normalized.trackingUrl = `${process.env.API_BASE_URL || 'http://localhost:3377'}/click/${normalized.id}`;
    normalized.clickCount = await this.clicksService.getListingClickCount(id);
    return normalized;
  }

  async autocompleteBrands(city: string, q?: string): Promise<string[]> {
    const where: any = { city: { contains: city, mode: 'insensitive' } };
    if (q && q.trim()) {
      where.brand = { contains: q.trim(), mode: 'insensitive' };
    }
    const listings = await this.prisma.listing.findMany({
      where,
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
      take: 20,
    });
    return listings.map((l) => l.brand);
  }

  async autocompleteModels(city: string, q?: string, brand?: string): Promise<string[]> {
    const where: any = { city: { contains: city, mode: 'insensitive' } };
    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    if (q && q.trim()) where.model = { contains: q.trim(), mode: 'insensitive' };
    const listings = await this.prisma.listing.findMany({
      where,
      select: { model: true },
      distinct: ['model'],
      orderBy: { model: 'asc' },
      take: 20,
    });
    return listings.map((l) => l.model);
  }

  private async getClickCountsForListings(listingIds: string[]): Promise<Record<string, number>> {
    if (listingIds.length === 0) return {};
    const clickCounts = await this.prisma.click.groupBy({
      by: ['listingId'],
      where: { listingId: { in: listingIds } },
      _count: { id: true },
    });

    const countsMap: Record<string, number> = {};
    clickCounts.forEach((item) => {
      if (item.listingId !== null) {
        countsMap[String(item.listingId)] = item._count.id;
      }
    });

    listingIds.forEach((id) => {
      if (!countsMap[String(id)]) countsMap[String(id)] = 0;
    });

    return countsMap;
  }
}
