import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AgencyService {
  constructor(private prisma: PrismaService) {}

  async getProfile(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        email: true,
        name: true,
        businessType: true,
        gstNumber: true,
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
        integrationType: true,
        cpc: true,
        isActive: true,
        onboardingStatus: true,
        approvalStatus: true,
        createdAt: true,
      },
    });
    if (!agency) throw new UnauthorizedException('Agency not found');
    return agency;
  }

  async updateProfile(agencyId: string, dto: UpdateProfileDto) {
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: {
        name: dto.name,
        businessType: dto.businessType,
        panNumber: dto.panNumber,
        contactPersonName: dto.contactPersonName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        websiteUrl: dto.websiteUrl,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        country: dto.country,
      },
    });
    return { message: 'Profile updated successfully' };
  }
}
