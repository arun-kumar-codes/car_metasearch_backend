import { Controller, Get, Post, Body, Param, Query, Res, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ClicksService } from './clicks.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles';

@Controller('click')
export class ClicksController {
  constructor(
    private clicksService: ClicksService,
    private prisma: PrismaService,
  ) {}

  private agencyId(req: { user: { id: string; agencyId?: string } }) {
    return (req.user as { agencyId?: string }).agencyId ?? req.user.id;
  }

  @Post('lead')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEALER_ADMIN, Role.DEALER_USER)
  async markAsLead(
    @Body() body: { clickId: string },
    @Req() req: { user: { id: string; agencyId?: string } },
  ) {
    const { clickId } = body;
    if (!clickId) throw new ForbiddenException('clickId required');
    return this.clicksService.markClickAsLead(clickId, this.agencyId(req));
  }

  @Post('whatsapp-lead')
  async recordWhatsAppLead(
    @Body() body: { listingId?: string; agencyId?: string },
    @Req() req: Request,
  ) {
    const listingId = body?.listingId;
    if (!listingId) throw new BadRequestException('listingId required');

    const ipAddress = (req as any).ip || req.headers['x-forwarded-for']?.toString() || undefined;
    const userAgent = req.headers['user-agent'] || undefined;
    const referer = 'whatsapp';

    // Derive agencyId from listing to avoid mismatches.
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, agencyId: true },
    });
    if (!listing) throw new BadRequestException('listing not found');

    return this.clicksService.trackClick(listing.id, listing.agencyId, ipAddress, userAgent, referer);
  }

  @Get('stats/:agencyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEALER_ADMIN, Role.DEALER_USER)
  async getStats(
    @Param('agencyId') agencyId: string,
    @Query('startDate') startDateStr: string | undefined,
    @Query('endDate') endDateStr: string | undefined,
    @Req() req: { user: { id: string; agencyId?: string } },
  ) {
    if (this.agencyId(req) !== agencyId) throw new ForbiddenException('Access denied');
    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00.000Z') : undefined;
    const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59.999Z') : undefined;
    return this.clicksService.getClickStats(agencyId, startDate, endDate);
  }

  @Get('dashboard-summary/:agencyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEALER_ADMIN, Role.DEALER_USER)
  async getDashboardSummary(
    @Param('agencyId') agencyId: string,
    @Req() req: { user: { id: string; agencyId?: string } },
  ) {
    if (this.agencyId(req) !== agencyId) throw new ForbiddenException('Access denied');
    return this.clicksService.getDashboardSummary(agencyId);
  }

  @Get(':listingId')
  async trackAndRedirect(
    @Param('listingId') listingId: string,
    @Query('url') externalUrl: string | undefined,
    @Query('agencyId') agencyIdParam: string | undefined,
    @Query('cdpBaseUrl') cdpBaseUrlParam: string | undefined,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const ipAddress = (req as any).ip || req.headers['x-forwarded-for']?.toString() || undefined;
    const userAgent = req.headers['user-agent'] || undefined;
    const referer = req.headers.referer || undefined;

    let agencyId: string;
    let redirectUrl: string | null = null;
    let effectiveListingId: string | null = listingId;

    if (externalUrl && agencyIdParam) {
      agencyId = agencyIdParam;
      redirectUrl = await this.toAbsoluteDealerUrl(externalUrl, agencyId, cdpBaseUrlParam);
    } else {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: { agencyId: true, externalUrl: true },
      });
      if (!listing) return res.status(404).send('Listing not found');
      agencyId = listing.agencyId;
      redirectUrl = await this.toAbsoluteDealerUrl(listing.externalUrl, agencyId, cdpBaseUrlParam);
    }

    await this.clicksService.trackClick(effectiveListingId, agencyId, ipAddress, userAgent, referer);

    if (redirectUrl) return res.redirect(302, redirectUrl);
    return res.status(404).send('Redirect URL not found');
  }

  /**
   * Some feeds store external URLs as relative paths (e.g. /buy-used-car/...).
   * Convert to full dealer-domain URL using agency API source/base URL.
   */
  private async toAbsoluteDealerUrl(
    urlValue: string | null | undefined,
    agencyId: string,
    cdpBaseUrl?: string,
  ): Promise<string | null> {
    if (!urlValue) return null;
    const url = String(urlValue).trim();
    if (!url) return null;

    // Already absolute
    if (/^https?:\/\//i.test(url)) return url;

    // Prefer cdp base url from API payload when provided.
    if (cdpBaseUrl) {
      try {
        const base = new URL(cdpBaseUrl);
        const cleanPath = url.startsWith('/') ? url : `/${url}`;
        return `${base.protocol}//${base.host}${cleanPath}`;
      } catch {
        // ignore and fallback
      }
    }

    // Build from agency API source / legacy apiUrl domain
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        apiUrl: true,
        apiSources: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: { apiUrl: true },
          take: 1,
        },
      },
    });

    const sourceApiUrl = agency?.apiSources?.[0]?.apiUrl || agency?.apiUrl || '';
    if (!sourceApiUrl) return url.startsWith('/') ? null : `https://${url}`;

    try {
      const base = new URL(sourceApiUrl);
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      return `${base.protocol}//${base.host}${cleanPath}`;
    } catch {
      return url.startsWith('/') ? null : `https://${url}`;
    }
  }
}
