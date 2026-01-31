import { Module } from '@nestjs/common';
import { ClicksService } from './clicks.service';
import { ClicksController } from './clicks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClicksController],
  providers: [ClicksService],
  exports: [ClicksService],
})
export class ClicksModule {}
