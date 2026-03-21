import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AgencySearchResult, RawAgencyListing } from '../interfaces/agency-adapter.interface';
import { SearchQueryDto } from '../../search/dto/search-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { FieldMapperService } from '../services/field-mapper.service';

@Injectable()
export class ClientApiAgencyAdapter {
  constructor(
    private httpService: HttpService,
    private prisma: PrismaService,
    private fieldMapper: FieldMapperService,
  ) {}

  /**
   * Fetch full feed from agency: all configured API sources (and legacy single apiUrl) merged.
   * Used by API sync to extract and store listings.
   */
  async fetchFullFeed(agencyId: string): Promise<RawAgencyListing[]> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        apiUrl: true,
        apiKey: true,
        apiSources: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: { apiUrl: true, apiKey: true },
        },
      },
    });
    if (!agency) return [];

    const sources: { apiUrl: string; apiKey: string | null }[] = [];
    if (agency.apiSources?.length) {
      agency.apiSources.forEach((s) => sources.push({ apiUrl: s.apiUrl, apiKey: s.apiKey ?? null }));
    } else if (agency.apiUrl) {
      sources.push({ apiUrl: agency.apiUrl, apiKey: agency.apiKey ?? null });
    }
    if (sources.length === 0) return [];

    const allListings: RawAgencyListing[] = [];
    for (const source of sources) {
      try {
        const listings = await this.fetchFullFeedFromUrl(
          source.apiUrl,
          source.apiKey,
          agencyId,
        );
        allListings.push(...listings);
      } catch {
        // Skip failed source, continue with others
      }
    }
    return allListings;
  }

  /**
   * Fetch full feed from a single URL (used for multiple API sources per agency).
   */
  async fetchFullFeedFromUrl(
    apiUrl: string,
    apiKey: string | null,
    agencyId: string,
  ): Promise<RawAgencyListing[]> {
    const response = await this.httpService.axiosRef.get(apiUrl, {
      params: {},
      headers: {
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    return this.transformApiResponse(response.data, agencyId);
  }

  async search(query: SearchQueryDto, agencyId: string): Promise<AgencySearchResult> {
    const startTime = Date.now();

    try {
      const agency = await this.prisma.agency.findUnique({
        where: { id: agencyId },
        select: { id: true, name: true, apiUrl: true, apiKey: true, integrationType: true },
      });

      if (!agency) {
        return {
          agencyId,
          agencyName: 'Unknown',
          listings: [],
          success: false,
          error: 'Agency not found',
          responseTime: Date.now() - startTime,
        };
      }

      if (!agency.apiUrl) {
        return {
          agencyId,
          agencyName: agency.name,
          listings: [],
          success: false,
          error: 'API URL not configured',
          responseTime: Date.now() - startTime,
        };
      }

      const apiQuery = this.buildApiQuery(query);
      const response = await this.httpService.axiosRef.get(agency.apiUrl, {
        params: apiQuery,
        headers: {
          ...(agency.apiKey && { Authorization: `Bearer ${agency.apiKey}` }),
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const listings = this.transformApiResponse(response.data, agencyId);

      return {
        agencyId,
        agencyName: agency.name,
        listings,
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        agencyId,
        agencyName: 'Unknown',
        listings: [],
        success: false,
        error: error.message || 'API request failed',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private buildApiQuery(query: SearchQueryDto): Record<string, any> {
    const apiQuery: Record<string, any> = {};
    if (query.brand) apiQuery.brand = query.brand;
    if (query.model) apiQuery.model = query.model;
    if (query.year) apiQuery.year = query.year;
    if (query.minPrice !== undefined) apiQuery.minPrice = query.minPrice;
    if (query.maxPrice !== undefined) apiQuery.maxPrice = query.maxPrice;
    if (query.city) apiQuery.city = query.city;
    if (query.state) apiQuery.state = query.state;
    if (query.fuelType) apiQuery.fuelType = query.fuelType;
    if (query.transmission) apiQuery.transmission = query.transmission;
    if (query.bodyType) apiQuery.bodyType = query.bodyType;
    if (query.minMileage !== undefined) apiQuery.minMileage = query.minMileage;
    if (query.maxMileage !== undefined) apiQuery.maxMileage = query.maxMileage;
    if (query.minYear) apiQuery.minYear = query.minYear;
    return apiQuery;
  }

  private transformApiResponse(apiData: any, agencyId: string): RawAgencyListing[] {
    const items = Array.isArray(apiData)
      ? apiData
      : apiData?.data || apiData?.listings || apiData?.results || apiData?.items || [];
    return items.map((item: any) => {
      const id =
        this.fieldMapper.extractString(item, 'id', 'listingId', 'appointment_id', 'listing_id') ||
        `api-${Date.now()}-${Math.random()}`;
      const model = this.fieldMapper.extractString(item, 'model', 'carModel', 'car_name') || 'Unknown';
      const externalUrl = this.fieldMapper.extractString(
        item,
        'externalUrl',
        'url',
        'listingUrl',
        'cdp_relative_url',
      );
      const cdpBaseUrl = this.fieldMapper.extractString(
        item,
        'cdp_base_url',
        'cdpBaseUrl',
        'base_url',
        'baseUrl',
      );
      const brand = this.fieldMapper.extractBrand(
        item,
        model,
        externalUrl,
        'brand',
        'make',
        'manufacturer',
      );
      const variant = this.fieldMapper.extractString(item, 'variant', 'trim');
      const year = this.fieldMapper.extractInt(item, 'year', 'modelYear', 'myear') || new Date().getFullYear();
      const mileage = this.fieldMapper.extractInt(item, 'mileage', 'odometer', 'odometer.value', 'km');
      const price = this.fieldMapper.extractFloat(
        item,
        'price',
        'listingPrice',
        'listing_price',
        'priceAmount',
      );
      const currency = this.fieldMapper.extractString(item, 'currency') || 'INR';
      const color = this.fieldMapper.extractString(item, 'color', 'colour');
      const fuelType = this.fieldMapper.extractString(item, 'fuelType', 'fuel', 'fuel_type');
      const transmission = this.fieldMapper.extractString(
        item,
        'transmission',
        'gearType',
        'transmission_type.value',
        'transmission_type.display',
      );
      const bodyType = this.fieldMapper.extractString(item, 'bodyType', 'carType', 'body_type');
      const city = this.fieldMapper.extractString(
        item,
        'city',
        'locationCity',
        'address.locality',
        'address.city',
      );
      const state = this.fieldMapper.extractString(item, 'state', 'locationState', 'address.state');
      const country = this.fieldMapper.extractString(item, 'country', 'address.country') || 'India';
      const isAvailable =
        this.fieldMapper.extractBoolean(item, 'isAvailable', 'available') &&
        this.fieldMapper.extractString(item, 'status') !== 'sold' &&
        this.fieldMapper.extractString(item, 'listing') !== 'sold';
      const ownership = this.fieldMapper.extractOwnership(item, 'ownership', 'owner');

      // Extract images from API response
      const images = this.extractImages(item);

      return {
        id,
        agencyId,
        brand: brand || 'Unknown',
        make: brand || 'Unknown',
        model,
        variant,
        trim: variant,
        year,
        mileage,
        odometer: mileage,
        price,
        currency,
        color,
        fuelType,
        transmission,
        bodyType,
        city,
        state,
        country,
        isAvailable,
        externalUrl,
        cdpBaseUrl,
        ownership,
        images,
      };
    });
  }

  private extractImages(item: any): string[] {
    // Try various field names for images
    const imageFields = [
      'images',
      'imageUrls',
      'image_urls',
      'photos',
      'photoUrls',
      'photo_urls',
      'pictures',
      'pictureUrls',
      'picture_urls',
      'media',
      'mediaUrls',
      'media_urls',
    ];

    for (const field of imageFields) {
      if (item[field]) {
        if (Array.isArray(item[field])) {
          return item[field]
            .map((img: any) => {
              if (typeof img === 'string') return img;
              if (img?.url) return img.url;
              if (img?.src) return img.src;
              return null;
            })
            .filter((url: string | null): url is string => url !== null && url.length > 0);
        }
      }
    }

    // Try single image field (string URL)
    const singleImageFields = [
      'image',
      'imageUrl',
      'image_url',
      'photo',
      'photoUrl',
      'photo_url',
      'thumbnail',
      'thumbnailUrl',
    ];
    for (const field of singleImageFields) {
      if (item[field] && typeof item[field] === 'string') {
        return [item[field]];
      }
    }

    // Try single image object with .uri or .url (e.g. listing_image: { uri: "..." })
    const singleImageObjectFields = [
      'listing_image',
      'listingImage',
      'detail_image',
      'detailImage',
      'image',
      'photo',
      'thumbnail',
    ];
    for (const field of singleImageObjectFields) {
      const obj = item[field];
      if (obj && typeof obj === 'object') {
        const url = obj.uri || obj.url || obj.src;
        if (url && typeof url === 'string') return [url];
      }
    }

    return [];
  }
}
