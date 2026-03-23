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
    const normalizedQuery = this.normalizeLocationAliases(query);
    const { page = 1, limit = 50, sortBy = 'price_asc' } = normalizedQuery;
    const agencyResults = await this.agencyOrchestrator.searchAllAgencies(normalizedQuery);
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
          const hasExternalUrl = listing.externalUrl && String(listing.externalUrl).trim();
          if (agency?.integrationType !== 'APIFY' && hasExternalUrl) {
            const baseUrl = `${process.env.API_BASE_URL || 'http://localhost:3377'}/click/${listing.id}`;
            const params = new URLSearchParams({ url: listing.externalUrl!, agencyId: result.agencyId });
            if (listing.cdpBaseUrl) params.set('cdpBaseUrl', listing.cdpBaseUrl);
            listing.trackingUrl = `${baseUrl}?${params.toString()}`;
          } else {
            listing.trackingUrl = undefined;
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

  /**
   * Normalize common city/state aliases in the incoming search filters.
   *
   * Why:
   * - Manual listings may store `city=Delhi` while UI sends `city=New Delhi`.
   * - UI may send `state=National Capital Territory of Delhi` while listings store `state=Delhi`.
   * - We normalize the query filters so `contains` matching behaves as expected.
   */
  private normalizeLocationAliases(query: SearchQueryDto): SearchQueryDto {
    const city = query.city ? String(query.city).trim() : "";
    const state = query.state ? String(query.state).trim() : undefined;

    const normCityLower = city.toLowerCase();
    const normStateLower = state ? state.toLowerCase() : undefined;

    const normalizedCity = (() => {
      if (!city) return city;
      // Delhi aliases
      if (
        normCityLower.includes("new delhi") ||
        normCityLower === "delhi" ||
        normCityLower.includes(" delhi") ||
        normCityLower.includes("delhi")
      ) {
        return "Delhi";
      }
      // Gurgaon aliases
      if (normCityLower.includes("gurugram") || normCityLower.includes("gurgaon")) return "Gurgaon";
      // Bangalore aliases
      if (normCityLower.includes("bengaluru") || normCityLower.includes("bangalore")) return "Bangalore";
      // Mumbai aliases
      if (normCityLower.includes("mumbai") || normCityLower.includes("bombay")) return "Mumbai";
      return city;
    })();

    const normalizedState = (() => {
      if (!state) return state;
      if (
        normStateLower?.includes("national capital territory") ||
        normStateLower?.includes("nct of delhi") ||
        normStateLower?.includes("nct") ||
        normStateLower?.includes("delhi")
      ) {
        return "Delhi";
      }
      return state;
    })();

    // Return a shallow clone so the rest of the pipeline uses normalized values.
    return {
      ...query,
      city: normalizedCity,
      state: normalizedState,
    };
  }

  async getByIds(ids: string[]): Promise<ListingResponseDto[]> {
    if (!ids.length) return [];
    const uniqueIds = [...new Set(ids)];
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: uniqueIds } },
      include: { agency: { select: { id: true, name: true, cpc: true, integrationType: true, whatsappNumber: true } } },
    });
    const results: ListingResponseDto[] = [];
    const baseUrl = `${process.env.API_BASE_URL || 'http://localhost:3377'}/click`;
    for (const listing of listings) {
      const raw = {
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
        images: this.parseImages(listing.images),
      };
      const normalized = this.normalizationService.normalize(raw);
      normalized.agency.name = listing.agency.name;
      normalized.agency.cpc = listing.agency.cpc || 0;
      (normalized.agency as any).whatsappNumber = listing.agency.whatsappNumber ?? undefined;
      const hasExternalUrl = normalized.externalUrl && String(normalized.externalUrl).trim();
      if (listing.agency.integrationType !== 'APIFY' && hasExternalUrl) {
        const params = new URLSearchParams({ url: normalized.externalUrl!, agencyId: listing.agencyId });
        if (normalized.cdpBaseUrl) params.set('cdpBaseUrl', normalized.cdpBaseUrl);
        normalized.trackingUrl = `${baseUrl}/${normalized.id}?${params.toString()}`;
      } else {
        normalized.trackingUrl = undefined;
      }
      normalized.clickCount = await this.clicksService.getListingClickCount(listing.id);
      results.push(normalized);
    }
    const idOrder = new Map(uniqueIds.map((id, i) => [id, i]));
    results.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    return results;
  }

  async getById(id: string): Promise<ListingResponseDto | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { agency: { select: { id: true, name: true, cpc: true, integrationType: true, whatsappNumber: true } } },
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
      images: this.parseImages(listing.images),
    };
    const normalized = this.normalizationService.normalize(rawListing);
    normalized.agency.name = listing.agency.name;
    normalized.agency.cpc = listing.agency.cpc || 0;
    (normalized.agency as any).whatsappNumber = listing.agency.whatsappNumber ?? undefined;

    const hasExternalUrl = normalized.externalUrl && String(normalized.externalUrl).trim();
    if (listing.agency.integrationType !== 'APIFY' && hasExternalUrl) {
      const baseUrl = `${process.env.API_BASE_URL || 'http://localhost:3377'}/click/${normalized.id}`;
      const params = new URLSearchParams({ url: normalized.externalUrl!, agencyId: listing.agencyId });
      if (normalized.cdpBaseUrl) params.set('cdpBaseUrl', normalized.cdpBaseUrl);
      normalized.trackingUrl = `${baseUrl}?${params.toString()}`;
    } else {
      normalized.trackingUrl = undefined;
    }
    
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

  /** List brands (optionally filtered by city/state) for dropdowns. */
  async getBrands(city?: string, state?: string): Promise<string[]> {
    const where: any = { isAvailable: true };
    if (city?.trim()) where.city = { contains: city.trim(), mode: 'insensitive' };
    if (state?.trim()) where.state = { contains: state.trim(), mode: 'insensitive' };
    const listings = await this.prisma.listing.findMany({
      where,
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    });
    return listings.map((l) => l.brand);
  }

  /** List models (optionally filtered by brand, city, state). */
  async getModels(brand?: string, city?: string, state?: string): Promise<string[]> {
    const where: any = { isAvailable: true };
    if (brand?.trim()) where.brand = { contains: brand.trim(), mode: 'insensitive' };
    if (city?.trim()) where.city = { contains: city.trim(), mode: 'insensitive' };
    if (state?.trim()) where.state = { contains: state.trim(), mode: 'insensitive' };
    const listings = await this.prisma.listing.findMany({
      where,
      select: { model: true },
      distinct: ['model'],
      orderBy: { model: 'asc' },
    });
    return listings.map((l) => l.model);
  }

  /** List cities (optionally filtered by state). */
  async getCities(state?: string): Promise<string[]> {
    const where: any = { isAvailable: true };
    if (state?.trim()) where.state = { contains: state.trim(), mode: 'insensitive' };
    const listings = await this.prisma.listing.findMany({
      where,
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    return listings.map((l) => l.city).filter((c): c is string => c != null && c.trim() !== '');
  }

  /** List states. */
  async getStates(): Promise<string[]> {
    const listings = await this.prisma.listing.findMany({
      where: { isAvailable: true },
      select: { state: true },
      distinct: ['state'],
      orderBy: { state: 'asc' },
    });
    return listings.map((l) => l.state).filter((s): s is string => s != null && s.trim() !== '');
  }

  /** List body types (optionally filtered by city/state). */
  async getBodyTypes(city?: string, state?: string): Promise<string[]> {
    const where: any = { isAvailable: true };
    if (city?.trim()) where.city = { contains: city.trim(), mode: 'insensitive' };
    if (state?.trim()) where.state = { contains: state.trim(), mode: 'insensitive' };
    const listings = await this.prisma.listing.findMany({
      where,
      select: { bodyType: true },
      distinct: ['bodyType'],
      orderBy: { bodyType: 'asc' },
    });
    return listings.map((l) => l.bodyType).filter((b): b is string => b != null && b.trim() !== '');
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

  private parseImages(images: any): string[] | undefined {
    if (!images) return undefined;
    if (Array.isArray(images)) {
      return images
        .map((img) => (typeof img === 'string' ? img : null))
        .filter((img): img is string => img !== null);
    }
    return undefined;
  }
}
