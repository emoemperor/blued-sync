import { Module } from '@nestjs/common';
import { BluedService } from './blued.service';
import { HttpModule } from '@nestjs/axios';
import { BluedController } from './blued.controller';
import { BullModule } from '@nestjs/bullmq';
import { BluedConsumer } from './blued.consumers';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [
    HttpModule.register({}),
    BullModule.registerQueue({ name: 'blued' }),
  ],
  providers: [BluedService, BluedConsumer, PrismaService],
  controllers: [BluedController],
})
export class BluedModule {}
