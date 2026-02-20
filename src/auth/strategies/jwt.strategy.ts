import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, isPlatformAdmin } from '../constants/roles';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: { sub: string; phone?: string; role?: string; type?: string; agencyId?: string }) {
    const role = payload.role;

    if (payload.type === 'agency_user' && payload.agencyId) {
      const agencyUser = await this.prisma.agencyUser.findUnique({
        where: { id: payload.sub },
        include: { agency: { select: { id: true, name: true, approvalStatus: true, onboardingStatus: true } } },
      });
      if (!agencyUser || agencyUser.agencyId !== payload.agencyId) throw new UnauthorizedException('Agency user not found');
      return {
        id: agencyUser.id,
        agencyId: agencyUser.agencyId,
        email: agencyUser.email,
        name: agencyUser.name,
        role: agencyUser.role,
        approvalStatus: agencyUser.agency.approvalStatus,
        onboardingStatus: agencyUser.agency.onboardingStatus,
      };
    }

    if (role === Role.USER) {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, phone: true, name: true, email: true, suggestionsOptIn: true },
      });
      if (!user) throw new UnauthorizedException('User not found');
      return {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        suggestionsOptIn: user.suggestionsOptIn,
        role: Role.USER,
      };
    }

    if (role && isPlatformAdmin(role)) {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, name: true },
      });
      if (!admin) throw new UnauthorizedException('Admin not found');
      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      };
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        name: true,
        phoneVerified: true,
        role: true,
        approvalStatus: true,
        onboardingStatus: true,
      },
    });

    if (!agency) throw new UnauthorizedException('Agency not found');
    if (agency.phone && !agency.phoneVerified) {
      throw new UnauthorizedException('Phone not verified');
    }

    return {
      id: agency.id,
      agencyId: agency.id,
      phone: agency.phone,
      name: agency.name,
      role: agency.role,
      approvalStatus: agency.approvalStatus,
      onboardingStatus: agency.onboardingStatus,
    };
  }
}
