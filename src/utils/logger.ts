import winston from 'winston';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'warn';
};

// Colors for levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Transport targets
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'all.log'),
  }),
];

export class Logger {
  private readonly logger: winston.Logger;
  private readonly context: string;

  constructor(context: string) {
    this.context = context;

    this.logger = winston.createLogger({
      level: level(),
      levels,
      format,
      transports,
    });
  }

  public info(message: string): void {
    this.logger.info(`[${this.context}] ${message}`);
  }

  public warn(message: string): void {
    this.logger.warn(`[${this.context}] ${message}`);
  }

  public error(message: string): void {
    this.logger.error(`[${this.context}] ${message}`);
  }

  public debug(message: string): void {
    this.logger.debug(`[${this.context}] ${message}`);
  }

  public logError(error: Error, customContext?: string): void {
    const errorContext = customContext ? `[${customContext}]` : '';
    const formattedMessage = `[${this.context}]${errorContext}: ${error.message}`;

    this.logger.error(formattedMessage, {
      name: error.name,
      stack: error.stack,
    });
  }

  public logRequest(req: Request): void {
    this.logger.http(`[${this.context}] ${req.method} ${req.url}`);
  }
}
