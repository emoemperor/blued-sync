import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from './base.entity';

@Entity()
export class SystemSetting extends BaseEntity {
  constructor() {
    super();
  }

  @Property()
  key: string;

  @Property()
  value: string;
}
