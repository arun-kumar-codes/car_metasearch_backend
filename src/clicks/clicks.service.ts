import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClicksService {
  constructor(private prisma: PrismaService) {}

  async trackClick(
    listingId: string | null,
    agencyId: string,
    ipAddress?: string,
    userAgent?: string,
    referer?: string,
  ) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true },
    });
    if (!agency) throw new Error(`Agency with ID ${agencyId} not found`);
    return this.prisma.click.create({
      data: {
        ...(listingId ? { listingId } : {}),
        agencyId,
        ipAddress,
        userAgent,
        referer,
      } as any,
    });
  }

  async getClickStats(agencyId: string, startDate?: Date, endDate?: Date) {
    const where: any = { agencyId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    const totalClicks = await this.prisma.click.count({ where });
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { cpc: true },
    });
    const totalCost = totalClicks * (agency?.cpc || 0);
    const clicksByListing = await this.prisma.click.groupBy({
      by: ['listingId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const clicks = await this.prisma.click.findMany({
      where,
      select: { createdAt: true },
    });
    const clicksByDate = clicks.reduce((acc, click) => {
      const date = click.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalClicks, totalCost, cpc: agency?.cpc || 0, clicksByListing, clicksByDate };
  }

  async getListingClickCount(listingId: string): Promise<number> {
    return this.prisma.click.count({ where: { listingId } });
  }

  async getAgencyClickCount(agencyId: string): Promise<number> {
    return this.prisma.click.count({ where: { agencyId } });
  }
}
