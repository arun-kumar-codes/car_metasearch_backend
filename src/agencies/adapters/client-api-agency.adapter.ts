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
    const items = apiData.data || apiData.listings || apiData.results || apiData.items || [];
    return items.map((item: any) => {
      const id = this.fieldMapper.extractString(item, 'id', 'listingId') || `api-${Date.now()}-${Math.random()}`;
      const model = this.fieldMapper.extractString(item, 'model', 'carModel') || 'Unknown';
      const externalUrl = this.fieldMapper.extractString(item, 'externalUrl', 'url', 'listingUrl');
      const brand = this.fieldMapper.extractBrand(item, model, externalUrl, 'brand', 'make', 'manufacturer');
      const variant = this.fieldMapper.extractString(item, 'variant', 'trim');
      const year = this.fieldMapper.extractInt(item, 'year', 'modelYear', 'myear') || new Date().getFullYear();
      const mileage = this.fieldMapper.extractInt(item, 'mileage', 'odometer', 'km');
      const price = this.fieldMapper.extractFloat(item, 'price', 'listingPrice', 'priceAmount');
      const currency = this.fieldMapper.extractString(item, 'currency') || 'INR';
      const color = this.fieldMapper.extractString(item, 'color', 'colour');
      const fuelType = this.fieldMapper.extractString(item, 'fuelType', 'fuel');
      const transmission = this.fieldMapper.extractString(item, 'transmission', 'gearType');
      const bodyType = this.fieldMapper.extractString(item, 'bodyType', 'carType');
      const city = this.fieldMapper.extractString(item, 'city', 'locationCity');
      const state = this.fieldMapper.extractString(item, 'state', 'locationState');
      const country = this.fieldMapper.extractString(item, 'country') || 'India';
      const isAvailable = this.fieldMapper.extractBoolean(item, 'isAvailable', 'available') && this.fieldMapper.extractString(item, 'status') !== 'sold';
      // const externalUrl = this.fieldMapper.extractString(item, 'externalUrl', 'url', 'listingUrl');
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

    // Try single image field
    const singleImageFields = ['image', 'imageUrl', 'image_url', 'photo', 'photoUrl', 'photo_url', 'thumbnail', 'thumbnailUrl'];
    for (const field of singleImageFields) {
      if (item[field] && typeof item[field] === 'string') {
        return [item[field]];
      }
    }

    return [];
  }
}
