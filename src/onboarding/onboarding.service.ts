import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingStep1Dto } from './dto/step-1.dto';
import { OnboardingStep2Dto } from './dto/step-2.dto';
import { OnboardingStep3Dto } from './dto/step-3.dto';
import { OnboardingStep4Dto } from './dto/step-4.dto';
import { OnboardingStep5Dto } from './dto/step-5.dto';

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
        registrationNumber: true,
        yearOfEstablishment: true,
        contactPersonName: true,
        contactPhone: true,
        contactEmail: true,
        whatsappNumber: true,
        websiteUrl: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
        serviceAreas: true,
        bankName: true,
        accountNumber: true,
        ifscCode: true,
        accountHolderName: true,
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
        registrationNumber: dto.registrationNumber,
        yearOfEstablishment: dto.yearOfEstablishment,
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
        whatsappNumber: dto.whatsappNumber,
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
        serviceAreas: dto.serviceAreas || undefined,
        onboardingStatus: 'IN_PROGRESS',
      },
    });
    return { message: 'Step 3 updated successfully' };
  }

  async updateStep4(agencyId: string, dto: OnboardingStep4Dto) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new UnauthorizedException('Agency not found');
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        ifscCode: dto.ifscCode,
        accountHolderName: dto.accountHolderName,
        onboardingStatus: 'IN_PROGRESS',
      },
    });
    return { message: 'Step 4 updated successfully' };
  }

  async updateStep5(agencyId: string, dto: OnboardingStep5Dto) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new UnauthorizedException('Agency not found');
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        apiUrl: dto.apiUrl,
        apiKey: dto.apiKey,
        integrationType: dto.apiUrl ? 'API' : 'DIRECT',
        onboardingStatus: 'IN_PROGRESS',
      },
    });
    return { message: 'Step 5 updated successfully' };
  }

  async submitOnboarding(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new UnauthorizedException('Agency not found');
    
    // Validate required fields
    const requiredFields = [
      { field: agency.name, message: 'Business name is required (Step 1)' },
      { field: agency.gstNumber, message: 'GST number is required (Step 1)' },
      { field: agency.contactEmail, message: 'Contact email is required (Step 2)' },
      { field: agency.bankName, message: 'Bank name is required (Step 4)' },
      { field: agency.accountNumber, message: 'Account number is required (Step 4)' },
      { field: agency.ifscCode, message: 'IFSC code is required (Step 4)' },
      { field: agency.accountHolderName, message: 'Account holder name is required (Step 4)' },
    ];

    const missingFields = requiredFields.filter(item => !item.field);
    if (missingFields.length > 0) {
      throw new BadRequestException(`Please complete all required steps: ${missingFields.map(f => f.message).join(', ')}`);
    }

    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { onboardingStatus: 'COMPLETED', approvalStatus: 'PENDING' },
    });
    return { message: 'Onboarding submitted successfully. Waiting for admin approval.' };
  }
}
