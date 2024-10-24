import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  Property,
} from '@mikro-orm/core';
import { BaseEntity } from 'src/base.entity';
import { Anchor } from './anchor.entity';
import { Chat } from './chat.entity';
import { Consume } from './consume.entity';

@Entity()
export class Live extends BaseEntity {
  constructor() {
    super();
  }

  @Property({ unique: true })
  lid: number;

  @Property()
  link: string;

  @Property()
  beans: number = 0;

  @ManyToOne(() => Anchor)
  anchor: Anchor;

  @OneToMany(() => Chat, (chat) => chat.live)
  chats = new Collection<Chat>(this);

  @OneToMany(() => Consume, (consume) => consume.live)
  consumes = new Collection<Consume>(this);
}
