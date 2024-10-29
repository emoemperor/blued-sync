import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { firstValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { Anchor } from '@prisma/client';
import { BluedApi } from 'blued-sdk';
import { ConfigService } from '@nestjs/config';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as duration from 'dayjs/plugin/duration';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma.service';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.tz.setDefault('Asia/Shanghai');

export interface ICheckLiveResponse {
  code: number;
  msg: string;
  data: { islive: boolean };
  extra: {};
}

@Injectable()
export class BluedService implements OnModuleInit {
  private readonly logger = new Logger(BluedService.name);
  private bluedClient: BluedApi;

  constructor(
    private readonly scheduleRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectQueue('blued') private readonly bluedQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.initBluedClient();
  }

  async getChatsByAnchorUid(uid: number) {
    return await this.prisma.anchor.findUnique({
      where: { uid },
      include: { Live: { include: { Chat: { include: { User: true } } } } },
    });
  }

  async getConsumeInfo(lid: number) {
    const consume = await this.prisma.consume.findMany({
      where: { Live: { lid } },
      include: { User: true },
    });
    const consumeInfo = consume.map((item) => ({
      user: item.User.name,
      amount: item.amount,
    }));
    return consumeInfo;
  }

  async getAllAnchors() {
    return await this.prisma.anchor.findMany();
  }

  async getAnchorInfo(uid: number) {
    return await this.prisma.anchor.findUnique({
      where: { uid },
      include: { Live: true },
    });
  }

  async unSubscribeAnchor(uid: number) {
    await this.prisma.anchor.update({
      where: { uid },
      data: { deleted: true },
    });
  }

  async searchAnchorByUid(uid: number) {
    try {
      const anchorInDb = await this.prisma.anchor.findUnique({
        where: { uid },
      });
      if (anchorInDb) {
        if (anchorInDb.deleted) {
          await this.prisma.anchor.update({
            where: { uid },
            data: { deleted: false },
          });
        }
        return anchorInDb;
      }
      const info = await BluedApi.getInfoByUid(uid);
      if (info) {
        const anchor = await this.prisma.anchor.create({
          data: {
            uid,
            name: info.userInfo.name,
            avatar: info.userInfo.avatar,
          },
        });
        return anchor;
      } else {
        throw new BadRequestException('找不到该主播');
      }
    } catch (error) {
      this.logger.error(`搜索主播失败: ${uid}`, error.message, error.stack);
      throw error;
    }
  }

  async searchAnchorByName(name: string) {
    try {
      const anchorInDb = await this.prisma.anchor.findFirst({
        where: { name },
      });
      if (anchorInDb) {
        if (anchorInDb.deleted) {
          await this.prisma.anchor.update({
            where: { uid: anchorInDb.uid },
            data: { deleted: false },
          });
        }
        return anchorInDb;
      }
      if (!this.bluedClient) {
        await this.initBluedClient();
      }
      const users = await this.bluedClient.searchUser(name);
      if (users.length === 0) {
        throw new BadRequestException('找不到该主播');
      }
      const user = users.find((user) => user.anchor);
      if (!user) {
        throw new BadRequestException('找不到该主播');
      }
      const anchor = await this.prisma.anchor.create({
        data: {
          uid: user.uid,
          name: user.name,
          avatar: user.avatar,
          is_live: user.live === 1,
        },
      });
      return anchor;
    } catch (error) {
      this.logger.error(`搜索主播失败: ${name}`, error.message, error.stack);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  private async dailyChangeUsername() {
    if (!this.bluedClient) {
      await this.initBluedClient();
    }
    const randomUsername = Math.random().toString(36).substring(7);
    this.logger.log('每日更换用户名', randomUsername);
    await this.bluedClient.editUsername(randomUsername);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  private async checkTask() {
    const anchors = await this.prisma.anchor.findMany();
    for (const anchor of anchors) {
      this.handleCheckTask(anchor);
    }
  }

  private async handleCheckTask(anchor: Anchor) {
    const isLive = await this.checkAnchorLiveStatus(anchor);
    if (anchor.deleted) return;
    if (isLive) {
      await this.handleLiveAnchor(anchor);
    } else {
      this.stopSyncTask(anchor);
    }
  }

  private async handleLiveAnchor(anchor: Anchor) {
    try {
      if (!this.bluedClient) {
        await this.initBluedClient();
      }
      const info = await BluedApi.getInfoByUid(anchor.uid);
      if (info && info.liveInfo) {
        const liveInDB = await this.prisma.live.findUnique({
          where: { lid: info.userInfo.live },
        });
        if (!liveInDB) {
          try {
            const enterInfo = await this.bluedClient.enterLive(
              info.userInfo.live,
            );
            await this.bluedClient.leaveLive(info.userInfo.live);
            await this.prisma.anchor.update({
              where: { uid: anchor.uid },
              data: { total_beans: enterInfo.beans_count },
            });
          } catch (error) {
            this.logger.error(`进入 ${anchor.name} 的直播间失败`);
          }

          const [hours, minutes, seconds] = info.liveInfo.initTime
            .split(':')
            .map(Number);
          await this.prisma.live.create({
            data: {
              lid: info.userInfo.live,
              link: `https:${info.liveInfo.liveUrl}`,
              anchor: { connect: { uid: anchor.uid } },
              beans: 0,
              createdAt: dayjs()
                .subtract(
                  dayjs
                    .duration({
                      hours,
                      minutes,
                      seconds,
                    })
                    .asSeconds(),
                  'seconds',
                )
                .toDate(),
            },
          });
          this.logger.log(`🎉 ${anchor.name} 开播了`);
        }
        this.startSyncTask(anchor, info.userInfo.live);
      }
    } catch (error) {
      this.logger.error(`处理 ${anchor.name} 失败`, error.message, error.stack);
    }
  }

  /**
   *  同步直播间聊天
   * @param lid  直播间ID
   */
  private async syncChat(lid: number) {
    try {
      const chats = await this.bluedClient.syncChat(lid);
      const contents = chats.map((chat) => chat.msg_content);
      const live = await this.prisma.live.findUnique({
        where: { lid },
        include: { anchor: true },
      });
      const chatsInDb = await this.prisma.chat.findMany({
        where: {
          Live: { lid },
          message: { in: contents },
        },
      });
      const chatsNotInDb = chats.filter((chat) => {
        const chatInDb = chatsInDb.find(
          (chatInDb) => chatInDb.message === chat.msg_content,
        );
        return !chatInDb;
      });
      const blockedWords = [
        'f',
        'ff',
        'F',
        'FF',
        '已婚聊天',
        '瘦f',
        '聊天f',
        'FFF',
      ];
      for (const chat of chatsNotInDb) {
        if (blockedWords.includes(chat.msg_content)) continue;
        this.bluedQueue.add('handleChat', {
          chat,
          live,
        });
      }
    } catch (error) {
      this.logger.error(`同步聊天失败: ${lid}`, error.message, error.stack);
    }
  }

  /**
   *  同步直播间消费
   * @param uid  用户ID
   * @param lid  直播间ID
   */
  private async syncConsume(uid: number, lid: number) {
    try {
      const consumes = [];
      let page = 1;
      while (page < 5) {
        const consume = await this.bluedClient.getLiveConsumes(uid, lid, page);
        if (consume.length === 0) {
          break;
        }
        consumes.push(...consume);
        page++;
      }
      for (const consume of consumes) {
        this.bluedQueue.add('handleConsume', {
          consume,
          lid,
        });
      }
      const beans = consumes.reduce((acc, cur) => acc + Number(cur.beans), 0);
      await this.prisma.live.update({
        where: { lid },
        data: { beans },
      });
    } catch (error) {
      this.logger.error(`同步消费失败: ${uid}`, error.message, error.stack);
    }
  }

  /**
   *  开启同步任务
   * @param anchor  主播信息
   * @param lid  直播间ID
   * @memberof BluedService
   */
  private startSyncTask(anchor: Anchor, lid: number) {
    const syncInterval = 1000 * 30;
    const syncChatTaskName = `${anchor.uid}-同步聊天`;
    const syncConsumeTaskName = `${anchor.uid}-同步消费`;
    try {
      if (!this.scheduleRegistry.getIntervals().includes(syncChatTaskName)) {
        const intervalId = setInterval(() => this.syncChat(lid), syncInterval);
        this.scheduleRegistry.addInterval(syncChatTaskName, intervalId);
      }
      if (!this.scheduleRegistry.getIntervals().includes(syncConsumeTaskName)) {
        const intervalId = setInterval(
          () => this.syncConsume(anchor.uid, lid),
          syncInterval,
        );
        this.scheduleRegistry.addInterval(syncConsumeTaskName, intervalId);
      }
    } catch (error) {
      this.logger.error(
        `开启同步任务失败: ${anchor.name}`,
        error.message,
        error.stack,
      );
    }
  }

  /**
   *  停止同步任务
   * @param anchor 主播信息
   * @memberof BluedService
   */
  private stopSyncTask(anchor: Anchor) {
    const syncChatTaskName = `${anchor.uid}-同步聊天`;
    const syncConsumeTaskName = `${anchor.uid}-同步消费`;
    try {
      if (this.scheduleRegistry.getIntervals().includes(syncChatTaskName)) {
        this.scheduleRegistry.deleteInterval(syncChatTaskName);
      }
      if (this.scheduleRegistry.getIntervals().includes(syncConsumeTaskName)) {
        this.scheduleRegistry.deleteInterval(syncConsumeTaskName);
      }
    } catch (error) {
      this.logger.error(
        `停止同步任务失败: ${anchor.name}`,
        error.message,
        error.stack,
      );
    }
  }

  private async initBluedClient() {
    console.log('initBluedClient');
    if (!this.bluedClient) {
      const setting = await this.prisma.setting.findFirst({
        where: {
          key: this.configService.get<string>('system_setting_key.blued_auth'),
        },
      });
      if (!setting) {
        return;
      }
      this.bluedClient = new BluedApi(
        async () => {
          return setting.value;
        },
        () => {
          this.bluedClient = undefined;
        },
      );
    }
  }

  /**
   * 检查主播的直播状态
   * @param anchor 主播信息
   * @returns 是否正在直播
   */
  private async checkAnchorLiveStatus(anchor: Anchor): Promise<boolean> {
    try {
      const { data } = await firstValueFrom(
        this.httpService
          .get<ICheckLiveResponse>(
            `https://app.blued.cn/live/islive/${BluedApi.encryptUid(anchor.uid)}`,
          )
          .pipe(map(({ data }) => data)),
      );
      if (anchor.is_live !== data.islive) {
        await this.prisma.anchor.update({
          where: { uid: anchor.uid },
          data: { is_live: data.islive },
        });
      }
      return data.islive;
    } catch (error) {
      this.logger.error(
        `检查 ${anchor.name} 直播状态失败`,
        error.message,
        error.stack,
      );
      return false;
    }
  }
}
