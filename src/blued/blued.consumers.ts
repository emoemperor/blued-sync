import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Chat as BluedChat, Consume as BluedConsume } from 'blued-sdk';
import { PrismaService } from 'src/prisma.service';
import { Live, User } from '@prisma/client';
import * as dayjs from 'dayjs';

@Processor('blued')
export class BluedConsumer extends WorkerHost {
  private readonly logger = new Logger(BluedConsumer.name);
  private loggerMap = new Map<number, Logger>();
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async process(
    job: Job<
      | {
          chat: BluedChat;
          live: Live;
        }
      | {
          consume: BluedConsume;
          lid: number;
        }
    >,
  ): Promise<void> {
    let user: User, live: Live;
    if ('chat' in job.data) {
      user = await this.createUserOrUpdateInNeed(
        job.data.chat.from_id,
        job.data.chat.from_nick_name,
      );
      live = job.data.live;
    } else {
      user = await this.createUserOrUpdateInNeed(
        Number(job.data.consume.uid),
        job.data.consume.name,
      );
      live = await this.prisma.live.findUnique({
        where: { lid: job.data.lid },
      });
    }

    switch (job.name) {
      case 'handleConsume':
        if ('consume' in job.data) {
          const cid = `${live.lid}-${user.uid}`;
          await this.prisma.consume.upsert({
            where: { cid },
            update: { amount: Number(job.data.consume.beans) },
            create: {
              cid,
              amount: Number(job.data.consume.beans),
              User: {
                connect: {
                  uid: user.uid,
                },
              },
              Live: {
                connect: {
                  lid: live.lid,
                },
              },
            },
          });
        }
        break;
      case 'handleChat':
        if ('chat' in job.data) {
          await this.createChatIfNotExist(job.data.chat, live, user);
        }
        break;

      default:
        break;
    }
    return;
  }

  /**
   *  创建用户或更新用户信息
   * @param uid  用户ID
   * @param name  用户名
   * @returns  用户信息
   */
  private async createUserOrUpdateInNeed(uid: number, name: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { uid } });
      if (user) {
        if (user.name !== name) {
          await this.prisma.historyName.create({
            data: {
              uid: user.uid,
              name: user.name,
            },
          });
          return await this.prisma.user.update({
            where: { uid },
            data: { name },
          });
        }
        return user;
      } else {
        return await this.prisma.user.create({
          data: {
            uid,
            name,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `创建用户失败: ${uid},${name}`,
        error.message,
        error.stack,
      );
    }
  }

  /**
   *  创建聊天信息
   * @param chat  聊天信息
   * @param lid  直播间ID
   * @param user  用户信息
   */
  private async createChatIfNotExist(chat: BluedChat, live: Live, user: User) {
    try {
      const cid = `${live.lid}-${user.uid}-${chat.msg_time}-${dayjs().format('SSS')}`;
      const chatInDb = await this.prisma.chat.findUnique({ where: { cid } });
      if (chatInDb) {
        return;
      }
      const newChat = await this.prisma.chat.create({
        data: {
          cid,
          message: chat.msg_content,
          User: {
            connect: {
              uid: user.uid,
            },
          },
          Live: {
            connect: {
              lid: live.lid,
            },
          },
          createdAt: new Date(chat.msg_time * 1000),
        },
        include: {
          Live: {
            include: {
              anchor: true,
            },
          },
        },
      });
      function fillNameToLength(str: string, length: number) {
        let s = str;
        const times = str.replace(/[^\x00-\xff]/g, 'aa').length;
        for (let i = 0; i < length - times; i++) {
          s = ' ' + s;
        }
        return s;
      }
      const logString = `【${chat.from_rich_level.toString().padStart(2, '0')}】${fillNameToLength(user.name, 16)}:${chat.msg_content}`;
      let log: Logger;
      if (this.loggerMap.has(newChat.Live.anchor.uid)) {
        log = this.loggerMap.get(newChat.Live.anchor.uid);
        log.log(logString);
      } else {
        log = new Logger(fillNameToLength(newChat.Live.anchor.name, 16));
        log.log(logString);
        this.loggerMap.set(newChat.Live.anchor.uid, log);
      }
    } catch (error) {
      this.logger.error(
        `创建聊天失败: ${JSON.stringify(chat, null, 2)},${JSON.stringify(user, null, 2)}`,
        error.message,
        error.stack,
      );
    }
  }
}
