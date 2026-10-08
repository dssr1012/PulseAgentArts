import { logger, childLogger, getCorrelationContext, setCorrelationContext } from './logger';

// 1. Basic logging at different levels
logger.info('Server started');
logger.warn({ feature: 'whatsapp' }, 'WhatsApp SSO not configured');
logger.error({ err: new Error('DB connection failed') }, 'Database error');

// 2. Logging with a child logger (adds context field to every log)
const authLogger = childLogger('AuthService');
authLogger.info('User logged in');
authLogger.error({ err: new Error('Invalid token') }, 'Token validation failed');

// 3. Logging with correlation context (automatic via AsyncLocalStorage)
// The correlation context (trace_id, span_id, req_id) is automatically
// merged into every log entry when inside an HTTP request handled by
// the CorrelationMiddleware.
function handleRequest() {
  const ctx = getCorrelationContext();
  logger.info({
    event: 'business_logic',
    user_id: '123',
    action: 'create_expense',
  }, 'Processing expense creation');
  // The log will automatically include trace_id, span_id, req_id
}

// 4. Manual correlation context (e.g., for background jobs)
function processBackgroundJob(jobId: string) {
  setCorrelationContext({
    trace_id: crypto.randomUUID(),
    span_id: crypto.randomUUID().replace(/-/g, '').substring(0, 16),
    req_id: jobId,
  });

  logger.info({ event: 'job_started', job_id: jobId }, 'Background job started');
  // All logs within this async context will include the correlation context
}

// 5. Error handling with structured stack traces
function handleError(err: unknown) {
  if (err instanceof Error) {
    logger.error({
      err,
      event: 'unhandled_error',
    }, err.message);
    // Pino's stdSerializers.err will include:
    // { type: 'TypeError', message: '...', stack: 'TypeError: ...\n    at ...' }
  } else {
    logger.error({
      err: { message: String(err) },
      event: 'unhandled_error',
    }, 'Non-Error exception');
  }
}

// 6. The uncaughtException and unhandledRejection handlers are registered
// in main.ts at the top level:
//   process.on('uncaughtException', (err) => {
//     logger.fatal({ err, event: 'uncaughtException' }, err.message);
//     process.exit(1);
//   });
//   process.on('unhandledRejection', (reason) => {
//     const err = reason instanceof Error ? reason : new Error(String(reason));
//     logger.fatal({ err, event: 'unhandledRejection' }, err.message);
//     process.exit(1);
//   });
