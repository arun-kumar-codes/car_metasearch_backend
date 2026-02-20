import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthService } from './admin-auth.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminController, AdminAuthController],
  providers: [AdminAuthService],
})
export class AdminModule {}
