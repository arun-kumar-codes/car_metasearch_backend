import { Controller, Get, Put, Post, Patch, Delete, Body, Param, UseGuards, Request, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApprovalGuard } from '../auth/guards/approval.guard';
import { Role } from '../auth/constants/roles';
import { AgencyService } from './agency.service';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { CreateAgencyUserDto } from './dto/create-agency-user.dto';
import { UpdateAgencyUserDto } from './dto/update-agency-user.dto';

type AgencyReqUser = { id: string; agencyId?: string };

function getAgencyId(user: AgencyReqUser): string {
  return (user as { agencyId?: string }).agencyId ?? user.id;
}

@Controller('agency')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DEALER_ADMIN, Role.DEALER_USER)
export class AgencyController {
  constructor(
    private agencyService: AgencyService,
    private storageService: StorageService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: { user: AgencyReqUser }) {
    return this.agencyService.getProfile(getAgencyId(req.user));
  }

  @Put('profile')
  @UseGuards(ApprovalGuard)
  async updateProfile(@Request() req: { user: AgencyReqUser }, @Body() dto: UpdateProfileDto) {
    return this.agencyService.updateProfile(getAgencyId(req.user), dto);
  }

  @Get('listings')
  @UseGuards(ApprovalGuard)
  async getListings(@Request() req: { user: AgencyReqUser }) {
    return this.agencyService.getListings(getAgencyId(req.user));
  }

  @Post('listings/upload-images')
  @UseGuards(ApprovalGuard)
  @UseInterceptors(FilesInterceptor('images', 10)) // Max 10 images
  async uploadImages(
    @Request() req: { user: AgencyReqUser },
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>,
  ) {
    if (!files || files.length === 0) {
      return { images: [] };
    }

    const uploadFiles = files.map((file) => ({
      buffer: file.buffer,
      mimetype: file.mimetype,
    }));

    const imageUrls = await this.storageService.uploadFiles(uploadFiles, 'listings');
    return { images: imageUrls };
  }

  @Post('listings')
  @UseGuards(ApprovalGuard)
  async createListing(@Request() req: { user: AgencyReqUser }, @Body() dto: CreateListingDto) {
    return this.agencyService.createListing(getAgencyId(req.user), dto);
  }

  @Patch('listings/:id')
  @UseGuards(ApprovalGuard)
  async updateListing(
    @Request() req: { user: AgencyReqUser },
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.agencyService.updateListing(getAgencyId(req.user), id, dto);
  }

  @Delete('listings/:id')
  @UseGuards(ApprovalGuard)
  async deleteListing(@Request() req: { user: AgencyReqUser }, @Param('id') id: string) {
    return this.agencyService.deleteListing(getAgencyId(req.user), id);
  }

  @Get('users')
  async getUsers(@Request() req: { user: AgencyReqUser }) {
    return this.agencyService.getUsers(getAgencyId(req.user));
  }

  @Post('users')
  @UseGuards(ApprovalGuard)
  @Roles(Role.DEALER_ADMIN)
  async createUser(@Request() req: { user: AgencyReqUser }, @Body() dto: CreateAgencyUserDto) {
    return this.agencyService.createUser(getAgencyId(req.user), dto);
  }

  @Patch('users/:id')
  @UseGuards(ApprovalGuard)
  @Roles(Role.DEALER_ADMIN)
  async updateUser(
    @Request() req: { user: AgencyReqUser },
    @Param('id') id: string,
    @Body() dto: UpdateAgencyUserDto,
  ) {
    return this.agencyService.updateUser(getAgencyId(req.user), id, dto);
  }

  @Delete('users/:id')
  @UseGuards(ApprovalGuard)
  @Roles(Role.DEALER_ADMIN)
  async deleteUser(@Request() req: { user: AgencyReqUser }, @Param('id') id: string) {
    return this.agencyService.deleteUser(getAgencyId(req.user), id, req.user.id);
  }
}
