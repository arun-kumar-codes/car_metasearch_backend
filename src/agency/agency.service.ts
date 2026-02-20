import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { CreateAgencyUserDto } from './dto/create-agency-user.dto';
import { UpdateAgencyUserDto } from './dto/update-agency-user.dto';

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
        cpc: true,
        isActive: true,
        onboardingStatus: true,
        approvalStatus: true,
        role: true,
        createdAt: true,
        _count: { select: { listings: true } },
      },
    });
    if (!agency) throw new UnauthorizedException('Agency not found');
    const { _count, ...rest } = agency;
    return { ...rest, activeListings: _count?.listings ?? 0 };
  }

  async updateProfile(agencyId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    
    // Business Information (panNumber and gstNumber are read-only and cannot be updated here)
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.businessType !== undefined) data.businessType = dto.businessType;
    if (dto.registrationNumber !== undefined) data.registrationNumber = dto.registrationNumber;
    if (dto.yearOfEstablishment !== undefined) data.yearOfEstablishment = dto.yearOfEstablishment;
    
    // Contact Information
    if (dto.contactPersonName !== undefined) data.contactPersonName = dto.contactPersonName;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail;
    if (dto.whatsappNumber !== undefined) data.whatsappNumber = dto.whatsappNumber;
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl;
    
    // Address Information
    if (dto.addressLine1 !== undefined) data.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined) data.addressLine2 = dto.addressLine2;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.pincode !== undefined) data.pincode = dto.pincode;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.serviceAreas !== undefined) data.serviceAreas = dto.serviceAreas || undefined;
    
    // Bank Information
    if (dto.bankName !== undefined) data.bankName = dto.bankName;
    if (dto.accountNumber !== undefined) data.accountNumber = dto.accountNumber;
    if (dto.ifscCode !== undefined) data.ifscCode = dto.ifscCode;
    if (dto.accountHolderName !== undefined) data.accountHolderName = dto.accountHolderName;
    
    // API Configuration
    if (dto.apiUrl !== undefined) {
      data.apiUrl = dto.apiUrl;
      data.integrationType = dto.apiUrl ? 'API' : 'DIRECT';
    }
    if (dto.apiKey !== undefined) data.apiKey = dto.apiKey;
    
    await this.prisma.agency.update({
      where: { id: agencyId },
      data,
    });
    return { message: 'Profile updated successfully' };
  }

  async getListings(agencyId: string) {
    return this.prisma.listing.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createListing(agencyId: string, dto: CreateListingDto) {
    return this.prisma.listing.create({
      data: {
        agencyId,
        brand: dto.brand,
        model: dto.model,
        variant: dto.variant ?? null,
        year: dto.year,
        mileage: dto.mileage,
        price: dto.price,
        currency: dto.currency ?? 'INR',
        color: dto.color ?? null,
        fuelType: dto.fuelType ?? null,
        transmission: dto.transmission ?? null,
        bodyType: dto.bodyType ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        country: dto.country ?? null,
        externalUrl: dto.externalUrl ?? null,
        ownership: dto.ownership ?? null,
        isAvailable: dto.isAvailable ?? true,
        images: dto.images && dto.images.length > 0 ? dto.images : undefined,
        imageSource: dto.images && dto.images.length > 0 ? 'S3' : null,
      },
    });
  }

  async updateListing(agencyId: string, listingId: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, agencyId },
    });
    if (!listing) throw new UnauthorizedException('Listing not found');
    const data: Record<string, unknown> = {};
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.variant !== undefined) data.variant = dto.variant ?? null;
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.mileage !== undefined) data.mileage = dto.mileage;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.color !== undefined) data.color = dto.color ?? null;
    if (dto.fuelType !== undefined) data.fuelType = dto.fuelType ?? null;
    if (dto.transmission !== undefined) data.transmission = dto.transmission ?? null;
    if (dto.bodyType !== undefined) data.bodyType = dto.bodyType ?? null;
    if (dto.city !== undefined) data.city = dto.city ?? null;
    if (dto.state !== undefined) data.state = dto.state ?? null;
    if (dto.country !== undefined) data.country = dto.country ?? null;
    if (dto.externalUrl !== undefined) data.externalUrl = dto.externalUrl ?? null;
    if (dto.ownership !== undefined) data.ownership = dto.ownership ?? null;
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;
    if (dto.images !== undefined) {
      data.images = dto.images.length > 0 ? dto.images : undefined;
      data.imageSource = dto.images.length > 0 ? 'S3' : null;
    }
    return this.prisma.listing.update({
      where: { id: listingId },
      data,
    });
  }

  async deleteListing(agencyId: string, listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, agencyId },
    });
    if (!listing) throw new UnauthorizedException('Listing not found');
    await this.prisma.listing.delete({ where: { id: listingId } });
    return { message: 'Listing deleted' };
  }

  async getUsers(agencyId: string) {
    return this.prisma.agencyUser.findMany({
      where: { agencyId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(agencyId: string, dto: CreateAgencyUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.agencyUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException('User with this email already exists');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = dto.role ?? 'DEALER_USER';
    const user = await this.prisma.agencyUser.create({
      data: {
        agencyId,
        email,
        passwordHash,
        name: dto.name ?? null,
        role,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return user;
  }

  async updateUser(agencyId: string, userId: string, dto: UpdateAgencyUserDto) {
    const agencyUser = await this.prisma.agencyUser.findFirst({
      where: { id: userId, agencyId },
    });
    if (!agencyUser) throw new UnauthorizedException('User not found');
    const data: { name?: string; role?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    return this.prisma.agencyUser.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async deleteUser(agencyId: string, userId: string, currentUserId: string) {
    if (userId === currentUserId) throw new ForbiddenException('Cannot delete yourself');
    const agencyUser = await this.prisma.agencyUser.findFirst({
      where: { id: userId, agencyId },
    });
    if (!agencyUser) throw new UnauthorizedException('User not found');
    await this.prisma.agencyUser.delete({ where: { id: userId } });
    return { message: 'User removed' };
  }
}
