import { Controller, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApifySyncService } from '../agencies/services/apify-sync.service';

@Controller('apify')
export class ApifyController {
  constructor(
    private prisma: PrismaService,
    private apifySyncService: ApifySyncService,
  ) {}

  @Get('agencies')
  async getAgencies() {
    const agencies = await this.prisma.agency.findMany({
      where: { integrationType: 'APIFY', apifyActorId: { not: null } },
      select: {
        id: true,
        name: true,
        apifyActorId: true,
        isActive: true,
        lastSyncedAt: true,
      },
    });
    return { agencies };
  }

  @Get('agencies/:id')
  async getAgency(@Param('id') id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        apifyActorId: true,
        isActive: true,
        lastSyncedAt: true,
      },
    });
    if (!agency) return { agency: null };
    return { agency };
  }

  @Post('sync')
  async syncAll() {
    const result = await this.apifySyncService.syncAll();
    return result;
  }
}
