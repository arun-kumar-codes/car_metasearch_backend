import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SearchModule } from './search/search.module';
import { ClicksModule } from './clicks/clicks.module';
import { WebhookModule } from './webhooks/webhook.module';
import { ApifyModule } from './apify/apify.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AgencyModule } from './agency/agency.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SearchModule,
    ClicksModule,
    WebhookModule,
    ApifyModule,
    AuthModule,
    OnboardingModule,
    AgencyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
