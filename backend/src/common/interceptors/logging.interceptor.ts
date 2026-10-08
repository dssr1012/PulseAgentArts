import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';
import { logger, getCorrelationContext } from '../logger/logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();
    const ctx = getCorrelationContext();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        logger.info({
          event: 'http_request',
          method,
          url,
          duration_ms: duration,
          trace_id: ctx?.trace_id,
          span_id: ctx?.span_id,
          req_id: ctx?.req_id,
        }, `${method} ${url} ${duration}ms`);
      }),
      catchError((err) => {
        const duration = Date.now() - startTime;
        logger.error({
          event: 'http_request_error',
          method,
          url,
          duration_ms: duration,
          err: err instanceof Error ? err : { message: String(err) },
          trace_id: ctx?.trace_id,
          span_id: ctx?.span_id,
          req_id: ctx?.req_id,
        }, `${method} ${url} ERROR`);
        return throwError(() => err);
      }),
    );
  }
}
