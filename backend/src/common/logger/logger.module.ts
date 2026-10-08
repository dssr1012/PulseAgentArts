import { Global, Module } from '@nestjs/common';
import { PinoLoggerService } from './logger.service';

@Global()
@Module({
  providers: [
    {
      provide: 'LoggerService',
      useClass: PinoLoggerService,
    },
    PinoLoggerService,
  ],
  exports: [PinoLoggerService, 'LoggerService'],
})
export class LoggerModule {}
