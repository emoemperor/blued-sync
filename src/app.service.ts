import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async setSystemSetting(key: string, value: any) {
    return await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getSystemSetting(key: string) {
    return await this.prisma.setting.findUnique({ where: { key } });
  }

  async getSystemSettings() {
    return await this.prisma.setting.findMany();
  }

  async deleteSystemSetting(key: string) {
    return await this.prisma.setting.delete({ where: { key } });
  }

  async setBluedToken(token: string) {
    const key = this.configService.get<string>('system_setting_key.blued_auth');
    return this.setSystemSetting(key, token);
  }
}
