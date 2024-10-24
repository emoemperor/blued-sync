import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MongoDriver } from '@mikro-orm/mongodb';
import { ScheduleModule } from '@nestjs/schedule';
import { BluedModule } from './blued/blued.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        driver: MongoDriver,
        clientUrl: configService.get<string>('database.host'),
        dbName: configService.get<string>('database.dbName'),
        entities: ['dist/**/*.entity.js'],
        entitiesTs: ['src/**/*.entity.ts'],
        // debug: process.env.NODE_ENV !== 'production',
        autoLoadEntities: true,
        ensureIndexes: true,
        allowGlobalContext: true,
      }),
    }),
    ScheduleModule.forRoot(),
    BluedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
