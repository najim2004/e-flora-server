import { NextFunction, Request, Response } from 'express';
import { Logger } from './logger';

// Base custom error with status code
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common HTTP errors
export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource Not Found') {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error') {
    super(500, message);
  }
}

export class ErrorHandler {
  private static readonly logger = Logger.getInstance('ErrorHandler');

  public static handleErrors = (
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';

    if (error instanceof HttpError) {
      statusCode = error.status;
      errorMessage = error.message;
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.name === 'CastError') {
      statusCode = 400;
      errorMessage = 'Invalid ID format';
    } else if (error.name === 'JsonWebTokenError') {
      statusCode = 401;
      errorMessage = 'Invalid token';
    } else if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      errorMessage = 'Token expired';
    }

    ErrorHandler.logger.logError(
      error,
      `${req.method} ${req.url} - ${statusCode} - ${req.headers['x-request-id']}`
    );

    res.status(statusCode).json({
      success: false,
      error: {
        message: errorMessage,
        status: statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
    });
  };
}
