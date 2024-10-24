import { EntityManager, Loaded } from '@mikro-orm/mongodb';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Chat as BluedChat, Consume as BluedConsume } from 'blued-sdk';
import { User } from './entities/user.entity';
import { Chat } from './entities/chat.entity';
import { Live } from './entities/live.entity';
import { Consume } from './entities/consume.entity';

@Processor('blued')
export class BluedConsumer extends WorkerHost {
  private readonly logger = new Logger(BluedConsumer.name);
  private loggerMap = new Map<number, Logger>();
  constructor(private readonly em: EntityManager) {
    super();
  }
  async process(
    job: Job<
      | {
          chat: BluedChat;
          live: Loaded<Live>;
        }
      | {
          consume: BluedConsume;
          lid: number;
        }
    >,
  ): Promise<void> {
    let user: Loaded<User>, live: Loaded<Live>;
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
      live = await this.em.findOne(Live, { lid: job.data.lid });
    }

    switch (job.name) {
      case 'handleConsume':
        if ('consume' in job.data) {
          const consumeInDb = await this.em.findOne(Consume, {
            live,
            user,
          });
          if (!consumeInDb) {
            const newConsume = new Consume();
            newConsume.amount = Number(job.data.consume.beans);
            newConsume.user = user;
            newConsume.live = live;
            await this.em.persistAndFlush(newConsume);
          } else {
            consumeInDb.amount = Number(job.data.consume.beans);
            await this.em.persistAndFlush(consumeInDb);
          }
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
      const user = await this.em.findOne(User, { uid });
      if (user) {
        if (user.name !== name) {
          user.history_name.push(user.name);
          user.name = name;
          await this.em.persistAndFlush(user);
          return user;
        }
        return user;
      } else {
        const newUser = new User();
        newUser.uid = uid;
        newUser.name = name;
        await this.em.persistAndFlush(newUser);
        return newUser;
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
  private async createChatIfNotExist(
    chat: BluedChat,
    live: Loaded<Live>,
    user: Loaded<User>,
  ) {
    try {
      let chatInDb = await this.em.findOne(Chat, {
        live,
        user,
        message: chat.msg_content,
      });
      if (!chatInDb) {
        const newChat = new Chat();
        newChat.live = live;
        newChat.user = user;
        newChat.message = chat.msg_content;
        newChat.createdAt = new Date(chat.msg_time * 1000);
        await this.em.persistAndFlush(newChat);

        function fillNameToLength(str: string, length: number) {
          let s = str;
          const times = str.replace(/[^\x00-\xff]/g, 'aa').length;
          for (let i = 0; i < length - times; i++) {
            s = ' ' + s;
          }
          return s;
        }
        if (live.anchor?.name) {
          const anchorName = fillNameToLength(live.anchor.name, 16);
          const logString = `【${chat.from_rich_level.toString().padStart(2, '0')}】${fillNameToLength(user.name, 16)}:${chat.msg_content}`;
          if (this.loggerMap.has(live.anchor.uid)) {
            this.loggerMap.get(live.anchor.uid).log(logString);
          } else {
            const logger = new Logger(anchorName);
            this.loggerMap.set(live.anchor.uid, logger);
            logger.log(logString);
          }
        }
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
