import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import config from './config';
import { ScheduleModule } from '@nestjs/schedule';
import { BluedModule } from './blued/blued.module';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BluedModule,
  ],
  controllers: [AppController, PrismaService],
  providers: [AppService],
})
export class AppModule {}
