import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isPlatformAdmin, isDealerRole } from '../constants/roles';

@Injectable()
export class ApprovalGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    if (isPlatformAdmin(user.role)) return true;
    if (!isDealerRole(user.role)) return false;

    const agency = await this.prisma.agency.findUnique({
      where: { id: user.id },
      select: { approvalStatus: true, onboardingStatus: true },
    });

    if (!agency) throw new ForbiddenException('Agency not found');
    if (agency.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Your agency is pending approval from superadmin. Please wait for approval.');
    }
    if (agency.onboardingStatus !== 'COMPLETED') {
      throw new ForbiddenException('Please complete onboarding first.');
    }
    return true;
  }
}
