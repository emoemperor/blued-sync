import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from 'src/base.entity';
import { Consume } from './consume.entity';
import { Chat } from './chat.entity';

@Entity()
export class User extends BaseEntity {
  constructor() {
    super();
  }

  @Property({ unique: true })
  uid: number;

  @Property()
  name: string;

  @Property({ default: [] })
  history_name: string[] = [];

  @OneToMany(() => Consume, (consume) => consume.user)
  consumes = new Collection<Consume>(this);

  @OneToMany(() => Chat, (chat) => chat.user)
  chats = new Collection<Chat>(this);
}
