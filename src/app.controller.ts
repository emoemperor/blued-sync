import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Post('blued-auth')
  setBluedToken(@Body('auth') token: string, @Body('key') key: string) {
    if (
      key !== this.configService.get<string>('system_setting_key.blued_auth')
    ) {
      throw new ForbiddenException('无效的 key');
    }
    return this.appService.setBluedToken(token);
  }
}
