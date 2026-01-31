import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencySearchResult, RawAgencyListing } from '../interfaces/agency-adapter.interface';
import { SearchQueryDto } from '../../search/dto/search-query.dto';

@Injectable()
export class DatabaseAgencyAdapter {
  constructor(private prisma: PrismaService) {}

  async search(query: SearchQueryDto, agencyId: string): Promise<AgencySearchResult> {
    const startTime = Date.now();

    try {
      const where: any = {
        agencyId,
        isAvailable: true,
      };

      if (query.brand) {
        where.brand = { contains: query.brand, mode: 'insensitive' };
      }
      if (query.model) {
        where.model = { contains: query.model, mode: 'insensitive' };
      }
      if (query.variant) {
        where.variant = { contains: query.variant, mode: 'insensitive' };
      }
      if (query.year || query.minYear) {
        if (query.year && !query.minYear) {
          where.year = query.year;
        } else if (query.minYear) {
          where.year = {
            gte: query.minYear,
            ...(query.year ? { lte: query.year } : {}),
          };
        }
      }
      if (query.minPrice !== undefined || query.maxPrice !== undefined) {
        where.price = {};
        if (query.minPrice !== undefined) where.price.gte = query.minPrice;
        if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
      }
      if (query.maxMileage !== undefined || query.minMileage !== undefined) {
        where.mileage = {};
        if (query.minMileage !== undefined) where.mileage.gte = query.minMileage;
        if (query.maxMileage !== undefined) where.mileage.lte = query.maxMileage;
      }
      if (query.city) {
        where.city = { contains: query.city, mode: 'insensitive' };
      }
      if (query.state) {
        where.state = { contains: query.state, mode: 'insensitive' };
      }
      if (query.fuelType) {
        where.fuelType = { equals: query.fuelType, mode: 'insensitive' };
      }
      if (query.transmission) {
        where.transmission = { equals: query.transmission, mode: 'insensitive' };
      }
      if (query.bodyType) {
        where.bodyType = { equals: query.bodyType, mode: 'insensitive' };
      }

      const agency = await this.prisma.agency.findUnique({
        where: { id: agencyId },
        select: { id: true, name: true },
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

      const listings = await this.prisma.listing.findMany({
        where,
        include: {
          agency: { select: { id: true, name: true } },
        },
      });

      const rawListings: RawAgencyListing[] = listings.map((listing) => ({
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
      }));

      return {
        agencyId: agency.id,
        agencyName: agency.name,
        listings: rawListings,
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        agencyId,
        agencyName: 'Unknown',
        listings: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      };
    }
  }
}
