import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ClicksService } from '../clicks/clicks.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../auth/constants/roles';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import * as bcrypt from 'bcrypt';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private clicksService: ClicksService,
  ) {}

  @Get('analytics')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async getAnalytics() {
    const [
      totalAgencies,
      approvedAgencies,
      pendingAgencies,
      rejectedAgencies,
      totalListings,
      availableListings,
      totalClicks,
      totalUsers,
      recentClicks,
      topAgencies,
    ] = await Promise.all([
      this.prisma.agency.count(),
      this.prisma.agency.count({ where: { approvalStatus: 'APPROVED' } }),
      this.prisma.agency.count({ where: { approvalStatus: 'PENDING', onboardingStatus: 'COMPLETED' } }),
      this.prisma.agency.count({ where: { approvalStatus: 'REJECTED' } }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { isAvailable: true } }),
      this.prisma.click.count(),
      this.prisma.user.count(),
      this.prisma.click.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.click.groupBy({
        by: ['agencyId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const topAgenciesWithNames = await Promise.all(
      topAgencies.map(async (item) => {
        const agency = await this.prisma.agency.findUnique({
          where: { id: item.agencyId },
          select: { name: true },
        });
        return {
          agencyId: item.agencyId,
          agencyName: agency?.name || 'Unknown',
          clicks: item._count.id,
        };
      }),
    );

    return {
      agencies: {
        total: totalAgencies,
        approved: approvedAgencies,
        pending: pendingAgencies,
        rejected: rejectedAgencies,
      },
      listings: {
        total: totalListings,
        available: availableListings,
      },
      clicks: {
        total: totalClicks,
        lastWeek: recentClicks,
      },
      users: {
        total: totalUsers,
      },
      topAgencies: topAgenciesWithNames,
    };
  }

  @Get('agencies/pending')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async getPendingAgencies() {
    return this.prisma.agency.findMany({
      where: {
        approvalStatus: 'PENDING',
        onboardingStatus: 'COMPLETED',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        gstNumber: true,
        businessType: true,
        contactPersonName: true,
        contactPhone: true,
        contactEmail: true,
        websiteUrl: true,
        addressLine1: true,
        city: true,
        state: true,
        onboardingStatus: true,
        approvalStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('agencies/all')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async getAllAgencies() {
    return this.prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        gstNumber: true,
        businessType: true,
        role: true,
        isActive: true,
        cpl: true,
        approvalStatus: true,
        onboardingStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('agencies/:id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async getAgencyById(@Param('id') agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        _count: { select: { listings: true, clicks: true } },
      },
    });
    if (!agency) throw new NotFoundException('Agency not found');
    const { password: _, ...rest } = agency;
    const leadsCount = await this.clicksService.getCplCount15DaySession(agencyId);
    return {
      ...rest,
      leadsCount,
    };
  }

  @Patch('agencies/:id')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async updateAgency(@Param('id') agencyId: string, @Body() dto: UpdateAgencyDto) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agency not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.businessType !== undefined) data.businessType = dto.businessType || null;
    if (dto.gstNumber !== undefined) data.gstNumber = dto.gstNumber || null;
    if (dto.panNumber !== undefined) data.panNumber = dto.panNumber || null;
    if (dto.registrationNumber !== undefined) data.registrationNumber = dto.registrationNumber || null;
    if (dto.yearOfEstablishment !== undefined) data.yearOfEstablishment = dto.yearOfEstablishment;
    if (dto.contactPersonName !== undefined) data.contactPersonName = dto.contactPersonName || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone || null;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail || null;
    if (dto.whatsappNumber !== undefined) data.whatsappNumber = dto.whatsappNumber || null;
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl || null;
    if (dto.addressLine1 !== undefined) data.addressLine1 = dto.addressLine1 || null;
    if (dto.addressLine2 !== undefined) data.addressLine2 = dto.addressLine2 || null;
    if (dto.city !== undefined) data.city = dto.city || null;
    if (dto.state !== undefined) data.state = dto.state || null;
    if (dto.pincode !== undefined) data.pincode = dto.pincode || null;
    if (dto.country !== undefined) data.country = dto.country || null;
    if (dto.bankName !== undefined) data.bankName = dto.bankName || null;
    if (dto.accountNumber !== undefined) data.accountNumber = dto.accountNumber || null;
    if (dto.ifscCode !== undefined) data.ifscCode = dto.ifscCode || null;
    if (dto.accountHolderName !== undefined) data.accountHolderName = dto.accountHolderName || null;
    if (dto.apiUrl !== undefined) data.apiUrl = dto.apiUrl || null;
    if (dto.apiKey !== undefined) data.apiKey = dto.apiKey || null;
    if (dto.integrationType !== undefined) data.integrationType = dto.integrationType;
    if (dto.apifyActorId !== undefined) data.apifyActorId = dto.apifyActorId || null;
    if (dto.cpc !== undefined) data.cpc = dto.cpc;
    if (dto.cpl !== undefined) data.cpl = dto.cpl;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.onboardingStatus !== undefined) data.onboardingStatus = dto.onboardingStatus;
    if (dto.approvalStatus !== undefined) data.approvalStatus = dto.approvalStatus;
    if (dto.rejectionReason !== undefined) data.rejectionReason = dto.rejectionReason || null;
    if (dto.role !== undefined) data.role = dto.role;

    const updated = await this.prisma.agency.update({
      where: { id: agencyId },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        cpl: true,
        isActive: true,
        approvalStatus: true,
        updatedAt: true,
      },
    });
    return { message: 'Agency updated successfully', agency: updated };
  }

  @Delete('agencies/:id')
  @Roles(Role.SUPERADMIN)
  async deleteAgency(@Param('id') agencyId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new NotFoundException('Agency not found');
    await this.prisma.agency.delete({ where: { id: agencyId } });
    return { message: 'Agency deleted successfully' };
  }

  @Get('analytics/by-agency')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async getAnalyticsByAgency() {
    const agencies = await this.prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        cpc: true,
        cpl: true,
        isActive: true,
        approvalStatus: true,
        _count: {
          select: { listings: true, clicks: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const agencyIds = agencies.map((a) => a.id);
    const availableByAgency = await this.prisma.listing.groupBy({
      by: ['agencyId'],
      where: { agencyId: { in: agencyIds }, isAvailable: true },
      _count: { id: true },
    });
    const leadsMap = new Map<string, number>();
    for (const a of agencies) {
      const count = await this.clicksService.getCplCount15DaySession(a.id);
      leadsMap.set(a.id, count);
    }

    const availableMap = new Map(availableByAgency.map((x) => [x.agencyId, x._count.id]));

    return {
      agencies: agencies.map((a) => ({
        agencyId: a.id,
        agencyName: a.name,
        cpl: a.cpl,
        isActive: a.isActive,
        approvalStatus: a.approvalStatus,
        listingsCount: a._count.listings,
        availableListingsCount: availableMap.get(a.id) ?? 0,
        clicksCount: a._count.clicks,
        leadsCount: leadsMap.get(a.id) ?? 0,
      })),
    };
  }

  @Post('agencies/:id/approve')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async approveAgency(
    @Param('id') agencyId: string,
    @Request() req: { user: { id: string; role: string } },
  ) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    if (agency.approvalStatus === 'APPROVED') {
      throw new BadRequestException('Agency already approved');
    }

    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        isActive: true,
      },
    });

    return { message: 'Agency approved successfully' };
  }

  @Post('agencies/:id/reject')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async rejectAgency(
    @Param('id') agencyId: string,
    @Body() body: { reason: string },
    @Request() req: { user: { id: string; role: string } },
  ) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        rejectionReason: body.reason || 'Rejected by superadmin',
        isActive: false,
      },
    });

    return { message: 'Agency rejected successfully' };
  }

  @Post('agencies/:id/activate')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async activateAgency(@Param('id') agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { isActive: true },
    });

    return { message: 'Agency activated successfully' };
  }

  @Post('agencies/:id/deactivate')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async deactivateAgency(@Param('id') agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { isActive: false },
    });

    return { message: 'Agency deactivated successfully' };
  }

  @Get('listings')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async getListings(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('agencyId') agencyId?: string,
    @Query('brand') brand?: string,
    @Query('model') model?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageStr), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(limitStr), 10) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (agencyId?.trim()) where.agencyId = agencyId.trim();
    if (brand?.trim()) where.brand = { contains: brand.trim(), mode: 'insensitive' };
    if (model?.trim()) where.model = { contains: model.trim(), mode: 'insensitive' };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agency: { select: { id: true, name: true } },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      listings: listings.map((l) => ({
        id: l.id,
        agencyId: l.agencyId,
        agencyName: l.agency.name,
        brand: l.brand,
        model: l.model,
        variant: l.variant,
        year: l.year,
        mileage: l.mileage,
        price: l.price,
        currency: l.currency,
        city: l.city,
        state: l.state,
        isAvailable: l.isAvailable,
        createdAt: l.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Post('bills/generate')
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  async generateAgencyBills(@Body() body: { periodLabel?: string }) {
    const periodLabel = body?.periodLabel?.trim();
    if (!periodLabel || !/^\d{4}-\d{2}$/.test(periodLabel)) {
      throw new BadRequestException('periodLabel required as YYYY-MM (e.g. 2025-03)');
    }
    const [y, m] = periodLabel.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    const agencies = await this.prisma.agency.findMany({
      where: { isActive: true },
      select: { id: true, name: true, cpl: true },
    });
    const created: Array<{ agencyId: string; agencyName: string; amount: number }> = [];
    for (const agency of agencies) {
      const existing = await (this.prisma as any).agencyBill.findFirst({
        where: { agencyId: agency.id, periodLabel },
      });
      if (existing) continue;
      const cplCount = await this.clicksService.getCplCount15DaySession(agency.id, startDate, endDate);
      const amount = Math.round(cplCount * agency.cpl * 100) / 100;
      await (this.prisma as any).agencyBill.create({
        data: {
          agencyId: agency.id,
          periodLabel,
          amount,
          status: 'PENDING',
        },
      });
      created.push({ agencyId: agency.id, agencyName: agency.name, amount });
    }
    return { message: 'Agency bills generated for period', periodLabel, created };
  }

  @Get('admins')
  @Roles(Role.SUPERADMIN)
  async getAdmins() {
    const admins = await this.prisma.admin.findMany({
      select: { id: true, email: true, role: true, name: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { admins };
  }

  @Post('admins')
  @Roles(Role.SUPERADMIN)
  async createAdmin(@Body() dto: CreateAdminDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.admin.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const admin = await this.prisma.admin.create({
      data: {
        email,
        passwordHash,
        role: Role.ADMIN,
        name: dto.name?.trim() || null,
      },
      select: { id: true, email: true, role: true, name: true, createdAt: true },
    });
    return { message: 'Admin created successfully', admin };
  }
}
