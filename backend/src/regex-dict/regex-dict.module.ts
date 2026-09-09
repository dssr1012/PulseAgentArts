import { Module } from '@nestjs/common';
import { RegexDictController } from './regex-dict.controller';
import { RegexDictService } from './regex-dict.service';

@Module({
  controllers: [RegexDictController],
  providers: [RegexDictService],
  exports: [RegexDictService],
})
export class RegexDictModule {}