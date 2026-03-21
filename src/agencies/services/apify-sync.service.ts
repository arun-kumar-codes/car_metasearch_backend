import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApifyService } from './apify.service';
import { RawAgencyListing } from '../interfaces/agency-adapter.interface';
import { FieldMapperService } from './field-mapper.service';

@Injectable()
export class ApifySyncService {
  constructor(
    private prisma: PrismaService,
    private apifyService: ApifyService,
    private fieldMapper: FieldMapperService,
  ) {}

  async syncAll(): Promise<{ synced: string[]; errors: { agencyId: string; error: string }[]; fallbacks: string[]; totalFound: number }> {
    const agencies = await this.prisma.agency.findMany({
      where: {
        integrationType: 'APIFY',
        apifyActorId: { not: null },
      },
      select: { id: true, name: true, apifyActorId: true, isActive: true },
    });

    const synced: string[] = [];
    const errors: { agencyId: string; error: string }[] = [];
    const fallbacks: string[] = [];

    for (const agency of agencies) {
      const actorId = agency.apifyActorId!;
      try {
        let defaultDatasetId: string | null = null;
        let usedFallback = false;

        const latest = await this.apifyService.getLatestDatasetId(actorId);
        if (latest) {
          const hoursSinceRun = (Date.now() - latest.finishedAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceRun <= 26) {
            defaultDatasetId = latest.datasetId;
          }
        }

        if (!defaultDatasetId) {
          usedFallback = true;
          fallbacks.push(agency.id);
          const result = await this.apifyService.runActor(actorId, {});
          defaultDatasetId = result.defaultDatasetId;
        }

        const datasetItems = await this.apifyService.getDatasetItems(defaultDatasetId);
        const rawListings: RawAgencyListing[] = [];
        for (const item of datasetItems) {
          try {
            const raw = await this.mapApifyItemToRawListing(item, agency.id, agency.name);
            rawListings.push(raw);
          } catch {
            // skip invalid item
          }
        }
        await this.prisma.listing.deleteMany({ where: { agencyId: agency.id } });
        for (const raw of rawListings) {
          await this.prisma.listing.create({
            data: {
              agencyId: raw.agencyId,
              listingSource: 'APIFY',
              brand: raw.brand || raw.make || 'Unknown',
              model: raw.model || 'Unknown',
              variant: raw.variant ?? null,
              year: raw.year || new Date().getFullYear(),
              mileage: raw.mileage ?? raw.odometer ?? 0,
              price: raw.price || 0,
              currency: raw.currency || 'INR',
              color: raw.color ?? null,
              fuelType: raw.fuelType ?? null,
              transmission: raw.transmission ?? null,
              bodyType: raw.bodyType ?? null,
              city: raw.city ?? null,
              state: raw.state ?? null,
              country: raw.country ?? 'India',
              isAvailable: raw.isAvailable !== false,
              externalUrl: raw.externalUrl ?? null,
              ownership: raw.ownership ?? null,
              images: raw.images && raw.images.length > 0 ? raw.images : undefined,
              imageSource: raw.images && raw.images.length > 0 ? 'EXTERNAL' : null,
            },
          });
        }
        await this.prisma.agency.update({
          where: { id: agency.id },
          data: { lastSyncedAt: new Date() },
        });
        synced.push(agency.id);
      } catch (err) {
        errors.push({ agencyId: agency.id, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return { synced, errors, fallbacks, totalFound: agencies.length };
  }

  private async constructExternalUrl(agencyId: string, relativeUrl: string | undefined): Promise<string | undefined> {
    if (!relativeUrl) return undefined;
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) return relativeUrl;
    const baseUrls: Record<string, string> = {
      hF7MRQOZbgTcuTlVu: 'https://www.cars24.com', // Fixed: Swapped - this actor ID is now Cars24
      vN8NN1KNVUQr7M8xM: 'https://www.spinny.com', // Fixed: Swapped - this actor ID is now Spinny
      Tx4vKBWNWT4uMbpft: 'https://www.cardekho.com',
    };
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { apifyActorId: true },
    });
    const actorId = agency?.apifyActorId;
    const baseUrl = actorId ? baseUrls[actorId] : '';
    if (!baseUrl) return relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    const clean = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    return `${baseUrl}${clean}`;
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

  private async mapApifyItemToRawListing(item: any, agencyId: string, agencyName: string): Promise<RawAgencyListing> {

    const id = this.fieldMapper.extractString(item, 'id', 'listingId') || `apify-${agencyId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const model = this.fieldMapper.extractString(item, 'model', 'carModel') || 'Unknown';
    const externalUrlRaw = this.fieldMapper.extractString(
      item,
      'cdp_relative_url',
      'permanent_url',
      'vlink',
      'url',
      'externalUrl',
      'listingUrl',
      'sourceUrl',
      'listing_url',
    );
    const cdpBaseUrl = this.fieldMapper.extractString(item, 'cdp_base_url', 'cdpBaseUrl', 'base_url', 'baseUrl');
    const externalUrlValue = await this.constructExternalUrl(agencyId, externalUrlRaw);
    const brand = this.fieldMapper.extractBrand(item, model, externalUrlValue, 'brand', 'make', 'manufacturer');
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
    const ownership = this.fieldMapper.extractOwnership(item, 'ownership', 'owner');
    
    // Extract images from scraped data
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
      externalUrl: externalUrlValue,
      cdpBaseUrl,
      ownership,
      images,
    };
  }
}
