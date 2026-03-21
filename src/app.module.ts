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
import { SyncModule } from './sync/sync.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AgencyModule } from './agency/agency.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { WatiModule } from './wati/wati.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    WatiModule,
    SearchModule,
    ChatModule,
    ClicksModule,
    WebhookModule,
    ApifyModule,
    SyncModule,
    AuthModule,
    OnboardingModule,
    AgencyModule,
    AdminModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
