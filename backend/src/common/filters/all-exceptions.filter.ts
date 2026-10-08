import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { logger, getCorrelationContext } from '../logger/logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message =
          (exceptionResponse as any).message || exception.message;
        errorCode =
          (exceptionResponse as any).errorCode || errorCode;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const correlationCtx = getCorrelationContext();
    const traceId = (request.headers['x-trace-id'] as string) || correlationCtx?.trace_id || crypto.randomUUID();

    const logData: Record<string, unknown> = {
      event: 'http_exception',
      trace_id: traceId,
      span_id: correlationCtx?.span_id,
      req_id: correlationCtx?.req_id,
      method: request.method,
      url: request.url,
      status_code: status,
      error_code: errorCode,
      message,
    };

    if (exception instanceof Error && !(exception instanceof HttpException)) {
      logData.err = {
        type: exception.constructor.name,
        message: exception.message,
        stack: exception.stack,
      };
    } else if (exception instanceof HttpException && status >= 500) {
      logData.err = {
        type: exception.constructor.name,
        message: exception.message,
        stack: exception.stack,
      };
    }

    logger.error(logData, `${request.method} ${request.url} ${status} ${errorCode}`);

    response.status(status).json({
      statusCode: status,
      errorCode,
      message: Array.isArray(message) ? message : [message],
      traceId,
      timestamp: new Date().toISOString(),
    });
  }
}
