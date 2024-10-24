import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from 'src/base.entity';
import { Live } from './live.entity';
import { User } from './user.entity';

@Entity()
export class Chat extends BaseEntity {
  @Property()
  message: string;

  @ManyToOne(() => Live)
  live: Live;

  @ManyToOne(() => User)
  user: User;
}
