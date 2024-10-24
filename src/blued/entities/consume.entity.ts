import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from 'src/base.entity';
import { User } from './user.entity';
import { Live } from './live.entity';

@Entity()
export class Consume extends BaseEntity {
  @Property({ default: 0 })
  amount: number = 0;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Live)
  live: Live;
}
