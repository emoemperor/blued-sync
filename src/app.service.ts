import { EntityManager } from '@mikro-orm/mongodb';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemSetting } from './system.entity';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
  ) {}

  async setSystemSetting(key: string, value: any) {
    const setting = await this.em.findOne(SystemSetting, { key });
    if (setting) {
      setting.value = value;
      await this.em.persistAndFlush(setting);
      return setting;
    } else {
      const newSetting = new SystemSetting();
      newSetting.key = key;
      newSetting.value = value;
      await this.em.persistAndFlush(newSetting);
      return newSetting;
    }
  }

  async getSystemSetting(key: string) {
    return this.em.findOne(SystemSetting, { key });
  }

  async getSystemSettings() {
    return this.em.find(SystemSetting, {});
  }

  async deleteSystemSetting(key: string) {
    const setting = await this.em.findOne(SystemSetting, { key });
    if (setting) {
      await this.em.removeAndFlush(setting);
      return setting;
    }
    return null;
  }

  async setBluedToken(token: string) {
    const key = this.configService.get<string>('system_setting_key.blued_auth');
    return this.setSystemSetting(key, token);
  }
}
