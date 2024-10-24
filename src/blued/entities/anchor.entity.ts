import { Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from 'src/base.entity';
import { BluedApi } from 'blued-sdk';
import { Live } from './live.entity';

@Entity()
export class Anchor extends BaseEntity {
  constructor() {
    super();
  }

  @Property({ unique: true })
  uid: number;

  @Property({
    onCreate(entity) {
      // @ts-ignore
      return BluedApi.encryptUid(entity.uid);
    },
  })
  encrypted_uid: string;

  @Property()
  name: string;

  @Property({ nullable: true })
  avatar: string;

  @Property({ nullable: true, default: false })
  is_live: boolean = false;

  @Property({ nullable: true })
  total_beans: number;

  @OneToMany(() => Live, (live) => live.anchor)
  lives = new Collection<Live>(this);

  @Property({ default: false })
  deleted: boolean = false;
}
