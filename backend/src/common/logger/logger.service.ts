import { Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { logger, childLogger } from './logger';

@Injectable()
export class PinoLoggerService implements LoggerService, OnModuleInit {
  onModuleInit() {
    logger.info({ event: 'logger_initialized' }, 'PinoLoggerService initialized');
  }

  log(message: any, context?: string): void {
    const child = context ? childLogger(context) : logger;
    if (typeof message === 'string') {
      child.info(message);
    } else {
      child.info(message);
    }
  }

  error(message: any, trace?: string, context?: string): void {
    const child = context ? childLogger(context) : logger;
    if (message instanceof Error) {
      child.error({ err: message }, message.message);
    } else if (typeof message === 'string') {
      if (trace) {
        child.error({ err: { message, stack: trace } }, message);
      } else {
        child.error(message);
      }
    } else {
      child.error(message);
    }
  }

  warn(message: any, context?: string): void {
    const child = context ? childLogger(context) : logger;
    if (typeof message === 'string') {
      child.warn(message);
    } else {
      child.warn(message);
    }
  }

  debug(message: any, context?: string): void {
    const child = context ? childLogger(context) : logger;
    if (typeof message === 'string') {
      child.debug(message);
    } else {
      child.debug(message);
    }
  }

  verbose(message: any, context?: string): void {
    const child = context ? childLogger(context) : logger;
    if (typeof message === 'string') {
      child.trace(message);
    } else {
      child.trace(message);
    }
  }

  fatal(message: any, context?: string): void {
    const child = context ? childLogger(context) : logger;
    if (message instanceof Error) {
      child.fatal({ err: message }, message.message);
    } else {
      child.fatal(message);
    }
  }
}
