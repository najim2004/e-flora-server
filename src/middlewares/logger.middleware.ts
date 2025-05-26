import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { Logger } from '../utils/logger';

// Masked request body logging
morgan.token('body', (req: Request) => {
  const body = { ...req.body };

  if (body.password) body.password = '***';
  if (body.confirmPassword) body.confirmPassword = '***';

  return JSON.stringify(body);
});

// Define Morgan format
const morganFormat = ':method :url :status :res[content-length] - :response-time ms :body';

export class LoggerMiddleware {
  private static loggerInstance = Logger.getInstance('LoggerMiddleware');

  // Morgan HTTP logger middleware
  public static morganLogger = morgan(morganFormat, {
    stream: {
      write: (message: string) => {
        LoggerMiddleware.loggerInstance.debug(message.trim());
      },
    },
  });

  // Custom request tracking middleware
  public static requestTracker(req: Request, res: Response, next: NextFunction): void {
    const logger = Logger.getInstance('RequestTracker');

    req.headers['x-request-id'] =
      req.headers['x-request-id'] || `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logMessage = `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ID: ${req.headers['x-request-id']}`;

      if (res.statusCode >= 400) {
        logger.warn(logMessage);
      } else {
        logger.info(logMessage);
      }
    });

    next();
  }
}
