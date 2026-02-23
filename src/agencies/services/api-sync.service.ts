import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientApiAgencyAdapter } from '../adapters/client-api-agency.adapter';
import { RawAgencyListing } from '../interfaces/agency-adapter.interface';

export interface ApiSyncResult {
  synced: string[];
  errors: { agencyId: string; error: string }[];
  totalAgencies: number;
  totalListings: number;
}

/**
 * Syncs listings from agency APIs into the database (metasearch pattern).
 * Runs periodically so search serves from DB only – no real-time API calls.
 * Supports multiple API sources per agency (AgencyApiSource) or legacy single apiUrl.
 */
@Injectable()
export class ApiSyncService {
  constructor(
    private prisma: PrismaService,
    private clientApiAdapter: ClientApiAgencyAdapter,
  ) {}

  /** Run API sync every 30 minutes so metasearch data stays up to date (no real-time calls). */
  @Cron('0 */30 * * * *')
  async runScheduledSync(): Promise<void> {
    await this.syncAll();
  }

  async syncAll(): Promise<ApiSyncResult> {
    const agencies = await this.prisma.agency.findMany({
      where: {
        integrationType: 'API',
        approvalStatus: 'APPROVED',
        OR: [
          { apiUrl: { not: null } },
          { apiSources: { some: { isActive: true } } },
        ],
      },
      select: { id: true, name: true },
    });

    const synced: string[] = [];
    const errors: { agencyId: string; error: string }[] = [];
    let totalListings = 0;

    for (const agency of agencies) {
      try {
        const count = await this.syncAgency(agency.id);
        synced.push(agency.id);
        totalListings += count;
      } catch (err) {
        errors.push({
          agencyId: agency.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      synced,
      errors,
      totalAgencies: agencies.length,
      totalListings,
    };
  }

  /**
   * Fetch from agency API and replace API-sourced listings in DB.
   * Manual listings (listingSource = 'MANUAL') are left unchanged.
   */
  async syncAgency(agencyId: string): Promise<number> {
    const rawListings = await this.clientApiAdapter.fetchFullFeed(agencyId);
    if (rawListings.length === 0) {
      await this.prisma.listing.deleteMany({
        where: { agencyId, listingSource: 'API' },
      });
      await this.prisma.agency.update({
        where: { id: agencyId },
        data: { lastSyncedAt: new Date() },
      });
      return 0;
    }

    await this.prisma.listing.deleteMany({
      where: { agencyId, listingSource: 'API' },
    });

    const payload = this.toListingCreateManyInput(agencyId, rawListings);
    await this.prisma.listing.createMany({ data: payload });

    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { lastSyncedAt: new Date() },
    });

    return rawListings.length;
  }

  private toListingCreateManyInput(agencyId: string, raw: RawAgencyListing[]) {
    return raw.map((r) => ({
      agencyId,
      listingSource: 'API' as const,
      externalId: r.id,
      brand: r.brand || r.make || 'Unknown',
      model: r.model || 'Unknown',
      variant: r.variant ?? r.trim ?? null,
      year: r.year || new Date().getFullYear(),
      mileage: r.mileage ?? r.odometer ?? 0,
      price: r.price ?? 0,
      currency: r.currency || 'INR',
      color: r.color ?? null,
      fuelType: r.fuelType ?? null,
      transmission: r.transmission ?? null,
      bodyType: r.bodyType ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      country: r.country ?? 'India',
      isAvailable: r.isAvailable !== false,
      externalUrl: r.externalUrl ?? null,
      ownership: r.ownership ?? null,
      images: r.images && r.images.length > 0 ? (r.images as string[]) : undefined,
      imageSource: r.images && r.images.length > 0 ? null : null, // API listings: null per schema
    }));
  }
}
