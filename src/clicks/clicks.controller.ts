import { Controller, Get, Post, Body, Param, Query, Res, Req, UseGuards, ForbiddenException } from '@nestjs/common';
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
      redirectUrl = externalUrl;
    } else {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: { agencyId: true, externalUrl: true },
      });
      if (!listing) return res.status(404).send('Listing not found');
      agencyId = listing.agencyId;
      redirectUrl = listing.externalUrl;
    }

    await this.clicksService.trackClick(effectiveListingId, agencyId, ipAddress, userAgent, referer);

    if (redirectUrl) return res.redirect(302, redirectUrl);
    return res.status(404).send('Redirect URL not found');
  }
}
