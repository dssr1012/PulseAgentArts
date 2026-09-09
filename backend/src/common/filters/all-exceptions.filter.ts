import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

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

    const traceId = request.headers['x-trace-id'] as string || crypto.randomUUID();

    this.logger.error(
      JSON.stringify({
        traceId,
        method: request.method,
        url: request.url,
        statusCode: status,
        errorCode,
        message,
        timestamp: new Date().toISOString(),
      }),
    );

    response.status(status).json({
      statusCode: status,
      errorCode,
      message: Array.isArray(message) ? message : [message],
      traceId,
      timestamp: new Date().toISOString(),
    });
  }
}