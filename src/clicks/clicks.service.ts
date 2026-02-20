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
    const whereLeads = { ...where, converted: true };
    const totalLeads = await this.prisma.click.count({ where: whereLeads });
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { cpc: true, cpl: true },
    });
    const cpc = agency?.cpc ?? 0;
    const totalCost = totalClicks * cpc;
    const configuredCpl = agency?.cpl ?? 0;
    const cpl = totalLeads > 0 ? totalCost / totalLeads : configuredCpl;
    const clicksByListing = await this.prisma.click.groupBy({
      by: ['listingId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const leadsByListing = await this.prisma.click.groupBy({
      by: ['listingId'],
      where: whereLeads,
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
    const leads = await this.prisma.click.findMany({
      where: whereLeads,
      select: { createdAt: true },
    });
    const leadsByDate = leads.reduce((acc, click) => {
      const date = click.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      totalClicks,
      totalCost,
      cpc,
      totalLeads,
      cpl,
      clicksByListing,
      clicksByDate,
      leadsByListing,
      leadsByDate,
    };
  }

  async markClickAsLead(clickId: string, agencyId: string): Promise<{ id: string; converted: boolean }> {
    const click = await this.prisma.click.findFirst({
      where: { id: clickId, agencyId },
    });
    if (!click) throw new Error('Click not found or access denied');
    const updated = await this.prisma.click.update({
      where: { id: clickId },
      data: { converted: true },
      select: { id: true, converted: true },
    });
    return updated;
  }

  async getListingClickCount(listingId: string): Promise<number> {
    return this.prisma.click.count({ where: { listingId } });
  }

  async getAgencyClickCount(agencyId: string): Promise<number> {
    return this.prisma.click.count({ where: { agencyId } });
  }

  async getDashboardSummary(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { cpc: true, cpl: true, _count: { select: { listings: true } } },
    });
    const cpc = agency?.cpc ?? 0;
    const configuredCpl = agency?.cpl ?? 0;
    const activeListings = agency?._count?.listings || 0;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    const allTimeClicks = await this.prisma.click.count({ where: { agencyId } });
    const todayClicks = await this.prisma.click.count({
      where: { agencyId, createdAt: { gte: todayStart } },
    });
    const yesterdayClicks = await this.prisma.click.count({
      where: { agencyId, createdAt: { gte: yesterdayStart, lt: todayStart } },
    });
    const weekClicks = await this.prisma.click.count({
      where: { agencyId, createdAt: { gte: weekStart } },
    });
    const lastWeekClicks = await this.prisma.click.count({
      where: { agencyId, createdAt: { gte: lastWeekStart, lt: weekStart } },
    });
    const monthClicks = await this.prisma.click.count({
      where: { agencyId, createdAt: { gte: monthStart } },
    });
    const lastMonthClicks = await this.prisma.click.count({
      where: { agencyId, createdAt: { gte: lastMonthStart, lt: monthStart } },
    });

    const totalBill = allTimeClicks * cpc;
    const monthBill = monthClicks * cpc;
    const lastMonthBill = lastMonthClicks * cpc;

    const allTimeLeads = await this.prisma.click.count({
      where: { agencyId, converted: true },
    });
    const todayLeads = await this.prisma.click.count({
      where: { agencyId, converted: true, createdAt: { gte: todayStart } },
    });
    const weekLeads = await this.prisma.click.count({
      where: { agencyId, converted: true, createdAt: { gte: weekStart } },
    });
    const monthLeads = await this.prisma.click.count({
      where: { agencyId, converted: true, createdAt: { gte: monthStart } },
    });
    const cpl = allTimeLeads > 0 ? totalBill / allTimeLeads : configuredCpl;

    const recentClicks = await this.prisma.click.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        listing: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
          },
        },
      },
    });

    const topListings = await this.prisma.click.groupBy({
      by: ['listingId'],
      where: { agencyId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 3,
    });

    const topListingsWithDetails = await Promise.all(
      topListings.map(async (item) => {
        if (!item.listingId) return null;
        const listing = await this.prisma.listing.findUnique({
          where: { id: item.listingId },
          select: { id: true, brand: true, model: true, year: true },
        });
        return listing ? { ...listing, clicks: item._count.id } : null;
      }),
    );

    return {
      activeListings,
      totalClicks: allTimeClicks,
      totalBill,
      cpc,
      totalLeads: allTimeLeads,
      cpl,
      configuredCpl,
      todayLeads,
      weekLeads,
      monthLeads,
      todayClicks,
      yesterdayClicks,
      weekClicks,
      lastWeekClicks,
      monthClicks,
      lastMonthClicks,
      monthBill,
      lastMonthBill,
      recentClicks: recentClicks.map((click) => ({
        id: click.id,
        listingId: click.listingId,
        listing: click.listing
          ? {
              id: click.listing.id,
              brand: click.listing.brand,
              model: click.listing.model,
              year: click.listing.year,
            }
          : null,
        createdAt: click.createdAt,
      })),
      topListings: topListingsWithDetails.filter((item) => item !== null),
    };
  }
}
