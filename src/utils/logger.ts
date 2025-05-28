import winston, { LoggerOptions } from 'winston';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';

// Constants
const LOG_DIR = 'logs';
const DEFAULT_ENV = 'development';

// Interfaces
type LogLevels = Record<'error' | 'warn' | 'info' | 'http' | 'debug', number>;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

const levels: LogLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

const colors: Record<keyof typeof levels, string> = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

class Logger {
  private static instances = new Map<string, Logger>();
  private readonly logger: winston.Logger;
  private readonly context: string;

  private constructor(context: string) {
    this.context = context;
    this.logger = this.initializeLogger(context);
  }

  public static getInstance(context: string): Logger {
    if (!context) {
      throw new Error('Context is required for logger initialization');
    }

    if (!Logger.instances.has(context)) {
      Logger.instances.set(context, new Logger(context));
    }
    return Logger.instances.get(context)!;
  }

  private determineLogLevel(): string {
    const env = process.env.NODE_ENV || DEFAULT_ENV;
    return env === 'development' ? 'debug' : 'warn';
  }

  private createTransports(context: string): winston.transport[] {
    return [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
      }),
      new winston.transports.File({
        filename: path.join(LOG_DIR, `${context}-error.log`),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(LOG_DIR, `${context}-all.log`),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ];
  }

  private initializeLogger(context: string): winston.Logger {
    winston.addColors(colors);

    const loggerOptions: LoggerOptions = {
      level: this.determineLogLevel(),
      levels,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
        winston.format.printf(this.createLogMessage.bind(this))
      ),
      transports: this.createTransports(context),
    };

    return winston.createLogger(loggerOptions);
  }

  private createLogMessage(info: winston.Logform.TransformableInfo): string {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: [${this.context}] ${message} ${metaString}`;
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  public logError(error: Error, customContext?: string): void {
    const errorContext = customContext ? `[${customContext}]` : '';
    this.logger.error(`${errorContext} ${error.message}`, {
      errorName: error.name,
      stackTrace: error.stack,
    });
  }

  public logRequest(req: Request): void {
    this.logger.http(`${req.method} ${req.url}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      body: req.body,
    });
  }
}

export default Logger;
