import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles';
import { RecordHistoryDto } from './dto/record-history.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ParseUUIDPipe } from '@nestjs/common';

interface UserRequest extends Request {
  user: { id: string; phone: string; role: string };
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('me/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async recordHistory(@Req() req: UserRequest, @Body() dto: RecordHistoryDto) {
    return this.usersService.recordHistory(req.user.id, dto.listingId);
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async getHistory(@Req() req: UserRequest) {
    return this.usersService.getHistory(req.user.id);
  }

  @Post('me/wishlist/:listingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async addWishlist(@Req() req: UserRequest, @Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.usersService.addWishlist(req.user.id, listingId);
  }

  @Delete('me/wishlist/:listingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async removeWishlist(@Req() req: UserRequest, @Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.usersService.removeWishlist(req.user.id, listingId);
  }

  @Get('me/wishlist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async getWishlist(@Req() req: UserRequest) {
    return this.usersService.getWishlist(req.user.id);
  }

  @Get('me/wishlist/:listingId/check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async checkWishlist(@Req() req: UserRequest, @Param('listingId', ParseUUIDPipe) listingId: string) {
    const inList = await this.usersService.isInWishlist(req.user.id, listingId);
    return { inWishlist: inList };
  }

  @Post('me/preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async updatePreferences(@Req() req: UserRequest, @Body() dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(req.user.id, dto);
  }

  @Get('me/preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER)
  async getPreferences(@Req() req: UserRequest) {
    return this.usersService.getProfile(req.user.id);
  }
}
