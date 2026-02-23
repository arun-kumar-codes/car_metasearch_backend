import { Module } from '@nestjs/common';
import { AgencyService } from './agency.service';
import { AgencyController } from './agency.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AgenciesModule } from '../agencies/agencies.module';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, AgenciesModule],
  controllers: [AgencyController],
  providers: [AgencyService],
})
export class AgencyModule {}
