import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApifyService } from './apify.service';
import { RawAgencyListing } from '../interfaces/agency-adapter.interface';

@Injectable()
export class ApifySyncService {
  constructor(
    private prisma: PrismaService,
    private apifyService: ApifyService,
  ) {}

  async syncAll(): Promise<{ synced: string[]; errors: { agencyId: string; error: string }[] }> {
    const agencies = await this.prisma.agency.findMany({
      where: {
        integrationType: 'APIFY',
        isActive: true,
        apifyActorId: { not: null },
      },
      select: { id: true, name: true, apifyActorId: true },
    });

    const synced: string[] = [];
    const errors: { agencyId: string; error: string }[] = [];

    for (const agency of agencies) {
      const actorId = agency.apifyActorId!;
      try {
        const { defaultDatasetId } = await this.apifyService.runActor(actorId, {});
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

    return { synced, errors };
  }

  private async constructExternalUrl(agencyId: string, relativeUrl: string | undefined): Promise<string | undefined> {
    if (!relativeUrl) return undefined;
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) return relativeUrl;
    const baseUrls: Record<string, string> = {
      hF7MRQOZbgTcuTlVu: 'https://www.spinny.com',
      vN8NN1KNVUQr7M8xM: 'https://www.cars24.com',
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

  private async mapApifyItemToRawListing(item: any, agencyId: string, agencyName: string): Promise<RawAgencyListing> {
    const externalUrlRaw = item.cdp_relative_url || item.permanent_url || item.vlink || item.url || item.externalUrl || item.listingUrl || item.sourceUrl || item.listing_url;
    const externalUrlValue = await this.constructExternalUrl(agencyId, externalUrlRaw);
    return {
      id: item.id || item.listingId || `apify-${agencyId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      agencyId,
      brand: item.brand || item.make || item.manufacturer,
      make: item.make || item.manufacturer,
      model: item.model || item.carModel,
      variant: item.variant || item.trim,
      trim: item.trim,
      year: item.year || item.modelYear || item.myear || new Date().getFullYear(),
      mileage: item.mileage ?? item.odometer ?? item.km ?? 0,
      odometer: item.odometer ?? item.mileage,
      price: item.price ?? item.listingPrice ?? item.priceAmount ?? 0,
      currency: item.currency || 'INR',
      color: item.color || item.colour,
      fuelType: item.fuelType || item.fuel,
      transmission: item.transmission || item.gearType,
      bodyType: item.bodyType || item.carType,
      city: item.city || item.locationCity,
      state: item.state || item.locationState,
      country: item.country || 'India',
      isAvailable: item.isAvailable !== false && item.status !== 'sold',
      externalUrl: externalUrlValue,
      ownership: item.ownership || item.owner,
    };
  }
}
