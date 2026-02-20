import { Controller, Get, Put, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles';
import { OnboardingService } from './onboarding.service';
import { OnboardingStep1Dto } from './dto/step-1.dto';
import { OnboardingStep2Dto } from './dto/step-2.dto';
import { OnboardingStep3Dto } from './dto/step-3.dto';
import { OnboardingStep4Dto } from './dto/step-4.dto';
import { OnboardingStep5Dto } from './dto/step-5.dto';

function agencyId(user: { id: string; agencyId?: string }): string {
  return (user as { agencyId?: string }).agencyId ?? user.id;
}

@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DEALER_ADMIN, Role.DEALER_USER)
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get()
  async getStatus(@Request() req: { user: { id: string; agencyId?: string } }) {
    return this.onboardingService.getOnboardingStatus(agencyId(req.user));
  }

  @Put('step/1')
  async updateStep1(@Request() req: { user: { id: string; agencyId?: string } }, @Body() dto: OnboardingStep1Dto) {
    return this.onboardingService.updateStep1(agencyId(req.user), dto);
  }

  @Put('step/2')
  async updateStep2(@Request() req: { user: { id: string; agencyId?: string } }, @Body() dto: OnboardingStep2Dto) {
    return this.onboardingService.updateStep2(agencyId(req.user), dto);
  }

  @Put('step/3')
  async updateStep3(@Request() req: { user: { id: string; agencyId?: string } }, @Body() dto: OnboardingStep3Dto) {
    return this.onboardingService.updateStep3(agencyId(req.user), dto);
  }

  @Put('step/4')
  async updateStep4(@Request() req: { user: { id: string; agencyId?: string } }, @Body() dto: OnboardingStep4Dto) {
    return this.onboardingService.updateStep4(agencyId(req.user), dto);
  }

  @Put('step/5')
  async updateStep5(@Request() req: { user: { id: string; agencyId?: string } }, @Body() dto: OnboardingStep5Dto) {
    return this.onboardingService.updateStep5(agencyId(req.user), dto);
  }

  @Post('submit')
  async submit(@Request() req: { user: { id: string; agencyId?: string } }) {
    return this.onboardingService.submitOnboarding(agencyId(req.user));
  }
}
