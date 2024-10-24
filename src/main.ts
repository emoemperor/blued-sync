import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CatchEverythingFilter } from './filters/catch.everything.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  app.useGlobalFilters(new CatchEverythingFilter());
  const conigService = app.get(ConfigService);
  const PORT = conigService.get<number>('port');
  await app.listen(PORT || 3000);
  const url = await app.getUrl();
  const logger = new Logger(bootstrap.name);
  logger.log(`Application is running on: ${url}`);
}

bootstrap();
