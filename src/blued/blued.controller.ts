import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { BluedService } from './blued.service';

@Controller('blued')
export class BluedController {
  constructor(private readonly bluedService: BluedService) {}

  @Get()
  getAnchorByUid(@Query('uid') uid: string, @Query('name') name: string) {
    if (name) {
      return this.bluedService.searchAnchorByName(name);
    }
    return this.bluedService.searchAnchorByUid(Number(uid));
  }

  @Get(':uid')
  getAnchorInfoByUid(@Param('uid', ParseIntPipe) uid: number) {
    return this.bluedService.getAnchorInfo(uid);
  }

  @Get('consume/:lid')
  getConsumeInfoByLid(@Param('lid', ParseIntPipe) lid: number) {
    return this.bluedService.getConsumeInfo(lid);
  }
}
