import { Module } from "@nestjs/common";
import { SttService } from "./stt.service";
import { VisionService } from "./vision.service";

@Module({
  providers: [SttService, VisionService],
  exports: [SttService, VisionService],
})
export class SttModule {}
