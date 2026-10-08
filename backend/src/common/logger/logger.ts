import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import pino, { Logger, LoggerOptions } from 'pino';

export interface CorrelationContext {
  trace_id: string;
  span_id: string;
  req_id: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

const SERVICE_NAME = process.env.SERVICE_NAME || 'pulse-backend';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (ENVIRONMENT === 'production' ? 'info' : 'debug');

const baseConfig: LoggerOptions = {
  level: LOG_LEVEL,
  base: {
    service_name: SERVICE_NAME,
    service_version: SERVICE_VERSION,
    environment: ENVIRONMENT,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: () => {
    const ctx = asyncLocalStorage.getStore();
    return ctx ? { ...ctx } : {};
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
};

const logger: Logger =
  ENVIRONMENT === 'production'
    ? pino(baseConfig)
    : pino({
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      });

export { logger, asyncLocalStorage };

export function getCorrelationContext(): CorrelationContext | undefined {
  return asyncLocalStorage.getStore();
}

export function setCorrelationContext(ctx: CorrelationContext): void {
  asyncLocalStorage.enterWith(ctx);
}

export function createCorrelationContext(headers: Record<string, string | string[] | undefined>): CorrelationContext {
  const incomingTraceId = headers['x-trace-id'] as string | undefined;
  const incomingSpanId = headers['x-span-id'] as string | undefined;
  const incomingReqId = headers['x-request-id'] as string | undefined;

  const spanId = randomUUID().replace(/-/g, '').substring(0, 16);

  return {
    trace_id: incomingTraceId || randomUUID(),
    span_id: incomingSpanId || spanId,
    req_id: incomingReqId || randomUUID(),
  };
}

export function childLogger(context: string): Logger {
  return logger.child({ context });
}
