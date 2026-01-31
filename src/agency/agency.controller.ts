import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgencyService } from './agency.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('agency')
@UseGuards(JwtAuthGuard)
export class AgencyController {
  constructor(private agencyService: AgencyService) {}

  @Get('profile')
  async getProfile(@Request() req: { user: { id: string } }) {
    return this.agencyService.getProfile(req.user.id);
  }

  @Put('profile')
  async updateProfile(@Request() req: { user: { id: string } }, @Body() dto: UpdateProfileDto) {
    return this.agencyService.updateProfile(req.user.id, dto);
  }
}
