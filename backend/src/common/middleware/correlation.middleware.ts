import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { asyncLocalStorage, createCorrelationContext, logger } from '../logger/logger';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const ctx = createCorrelationContext(req.headers as Record<string, string | string[] | undefined>);

    res.setHeader('x-trace-id', ctx.trace_id);
    res.setHeader('x-request-id', ctx.req_id);

    asyncLocalStorage.run(ctx, () => {
      next();
    });
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ctx = createCorrelationContext(req.headers as Record<string, string | string[] | undefined>);

  res.setHeader('x-trace-id', ctx.trace_id);
  res.setHeader('x-request-id', ctx.req_id);

  asyncLocalStorage.run(ctx, () => {
    next();
  });
}
