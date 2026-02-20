import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async recordHistory(userId: string, listingId: string) {
    await this.prisma.userListingView.upsert({
      where: {
        userId_listingId: { userId, listingId },
      },
      create: { userId, listingId },
      update: { viewedAt: new Date() },
    });
    return { success: true };
  }

  async getHistory(userId: string) {
    const views = await this.prisma.userListingView.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take: 100,
      select: { listingId: true, viewedAt: true },
    });
    if (views.length === 0) {
      return { items: [], listings: [] };
    }
    const listingIds = views.map((v) => v.listingId);
    const listings = await this.searchService.getByIds(listingIds);
    const listingMap = new Map(listings.map((l) => [l.id, l]));
    const items = views.map((v) => ({
      listingId: v.listingId,
      viewedAt: v.viewedAt,
      listing: listingMap.get(v.listingId) ?? null,
    }));
    return { items, listings };
  }

  async addWishlist(userId: string, listingId: string) {
    await this.prisma.userWishlist.upsert({
      where: {
        userId_listingId: { userId, listingId },
      },
      create: { userId, listingId },
      update: {},
    });
    return { success: true };
  }

  async removeWishlist(userId: string, listingId: string) {
    await this.prisma.userWishlist.deleteMany({
      where: { userId, listingId },
    });
    return { success: true };
  }

  async getWishlist(userId: string) {
    const rows = await this.prisma.userWishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { listingId: true, createdAt: true },
    });
    if (rows.length === 0) {
      return { items: [], listings: [] };
    }
    const listingIds = rows.map((r) => r.listingId);
    const listings = await this.searchService.getByIds(listingIds);
    const listingMap = new Map(listings.map((l) => [l.id, l]));
    const items = rows.map((r) => ({
      listingId: r.listingId,
      createdAt: r.createdAt,
      listing: listingMap.get(r.listingId) ?? null,
    }));
    return { items, listings };
  }

  async isInWishlist(userId: string, listingId: string): Promise<boolean> {
    const row = await this.prisma.userWishlist.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });
    return !!row;
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, phone: true, name: true, email: true, suggestionsOptIn: true },
    });
  }

  async updatePreferences(userId: string, data: { suggestionsOptIn?: boolean }) {
    if (data.suggestionsOptIn === undefined) {
      return this.getProfile(userId);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { suggestionsOptIn: data.suggestionsOptIn },
      select: { id: true, phone: true, name: true, email: true, suggestionsOptIn: true },
    });
    return user;
  }
}
