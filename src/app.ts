import express, { Application, Request, Response, json, urlencoded } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { ErrorHandler } from './utils/errors';
import { Logger } from './utils/logger';
import cookieParser from 'cookie-parser';
import { cropSuggestionRouter } from './routes/cropSuggestion.routes';

dotenv.config();

export class App {
  public app: Application;
  private logger = new Logger('App');

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();

    this.logger.info('Application initialized successfully');
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(cookieParser());
    // Request logging
    this.app.use(LoggerMiddleware.requestTracker);
    this.app.use(LoggerMiddleware.morganLogger);

    // Body parsers
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'OK', timestamp: new Date() });
    });
  }

  private initializeRoutes(): void {
    this.app.use('/api/v1/auth', authRouter);
    this.app.use('/api/v1/user', userRouter);
    this.app.use('/api/v1/crop', cropSuggestionRouter);

    // Handle 404
    this.app.use(/(.*)/, (req: Request, res: Response) => {
      this.logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        error: {
          message: 'Route not found',
          status: 404,
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(ErrorHandler.handleErrors);
  }
}
