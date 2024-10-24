import { Module } from '@nestjs/common';
import { BluedService } from './blued.service';
import { HttpModule } from '@nestjs/axios';
import { BluedController } from './blued.controller';

@Module({
  imports: [HttpModule.register({})],
  providers: [BluedService],
  controllers: [BluedController],
})
export class BluedModule {}
