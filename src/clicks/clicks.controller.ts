import { Controller, Get, Param, Query, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ClicksService } from './clicks.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('click')
export class ClicksController {
  constructor(
    private clicksService: ClicksService,
    private prisma: PrismaService,
  ) {}

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
