import { Controller, Get, Put, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { OnboardingStep1Dto } from './dto/step-1.dto';
import { OnboardingStep2Dto } from './dto/step-2.dto';
import { OnboardingStep3Dto } from './dto/step-3.dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get()
  async getStatus(@Request() req: { user: { id: string } }) {
    return this.onboardingService.getOnboardingStatus(req.user.id);
  }

  @Put('step/1')
  async updateStep1(@Request() req: { user: { id: string } }, @Body() dto: OnboardingStep1Dto) {
    return this.onboardingService.updateStep1(req.user.id, dto);
  }

  @Put('step/2')
  async updateStep2(@Request() req: { user: { id: string } }, @Body() dto: OnboardingStep2Dto) {
    return this.onboardingService.updateStep2(req.user.id, dto);
  }

  @Put('step/3')
  async updateStep3(@Request() req: { user: { id: string } }, @Body() dto: OnboardingStep3Dto) {
    return this.onboardingService.updateStep3(req.user.id, dto);
  }

  @Post('submit')
  async submit(@Request() req: { user: { id: string } }) {
    return this.onboardingService.submitOnboarding(req.user.id);
  }
}
