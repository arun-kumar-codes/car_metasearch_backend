import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SuperadminSignupDto } from './dto/superadmin-signup.dto';
import { SuperadminLoginDto } from './dto/superadmin-login.dto';
import { Role } from '../auth/constants/roles';

@Injectable()
export class AdminAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(dto: SuperadminSignupDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.admin.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already registered');

    const superadminCount = await this.prisma.admin.count({ where: { role: Role.SUPERADMIN } });
    if (superadminCount > 0) {
      const expected = process.env.SUPERADMIN_SIGNUP_KEY;
      if (!expected || dto.secret !== expected) {
        throw new UnauthorizedException('Not allowed');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const admin = await this.prisma.admin.create({
      data: {
        email,
        passwordHash,
        role: Role.SUPERADMIN,
        name: dto.name?.trim() || 'SuperAdmin',
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const accessToken = this.jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    return { accessToken, admin };
  }

  async login(dto: SuperadminLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }
}
