import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

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

  async validate(payload: { sub: string; email: string }) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, emailVerified: true },
    });
    if (!agency || !agency.emailVerified) throw new UnauthorizedException();
    return { id: agency.id, email: agency.email, name: agency.name };
  }
}
