import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingStep1Dto } from './dto/step-1.dto';
import { OnboardingStep2Dto } from './dto/step-2.dto';
import { OnboardingStep3Dto } from './dto/step-3.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getOnboardingStatus(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        name: true,
        gstNumber: true,
        onboardingStatus: true,
        approvalStatus: true,
        businessType: true,
        panNumber: true,
        contactPersonName: true,
        contactPhone: true,
        contactEmail: true,
        websiteUrl: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
        apiUrl: true,
        apiKey: true,
        integrationType: true,
        apifyActorId: true,
      },
    });
    if (!agency) throw new UnauthorizedException('Agency not found');
    return agency;
  }

  async updateStep1(agencyId: string, dto: OnboardingStep1Dto) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new UnauthorizedException('Agency not found');
    if (dto.gstNumber !== agency.gstNumber) {
      const existing = await this.prisma.agency.findUnique({ where: { gstNumber: dto.gstNumber } });
      if (existing && existing.id !== agencyId) throw new BadRequestException('GST number already registered');
    }
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        name: dto.name,
        businessType: dto.businessType,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        onboardingStatus: 'IN_PROGRESS',
      },
    });
    return { message: 'Step 1 updated successfully' };
  }

  async updateStep2(agencyId: string, dto: OnboardingStep2Dto) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new UnauthorizedException('Agency not found');
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        contactPersonName: dto.contactPersonName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        websiteUrl: dto.websiteUrl,
        onboardingStatus: 'IN_PROGRESS',
      },
    });
    return { message: 'Step 2 updated successfully' };
  }

  async updateStep3(agencyId: string, dto: OnboardingStep3Dto) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new UnauthorizedException('Agency not found');
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country || 'India',
        onboardingStatus: 'IN_PROGRESS',
      },
    });
    return { message: 'Step 3 updated successfully' };
  }

  async submitOnboarding(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new UnauthorizedException('Agency not found');
    if (!agency.name || !agency.gstNumber) throw new BadRequestException('Please complete all required steps before submitting');
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { onboardingStatus: 'COMPLETED', approvalStatus: 'PENDING' },
    });
    return { message: 'Onboarding submitted successfully. Waiting for admin approval.' };
  }
}
