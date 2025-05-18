import { Request, Response, NextFunction } from 'express';
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

// Centralized error handler middleware
export class ErrorHandler {
  private static logger = new Logger('ErrorHandler');
  public static handleErrors(error: Error, req: Request, res: Response, next: NextFunction): void {
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';

    // If it's our custom error with status
    if (error instanceof HttpError) {
      statusCode = error.status;
      errorMessage = error.message;
    } else if (error.name === 'ValidationError') {
      // Mongoose validation error
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.name === 'CastError') {
      // Mongoose cast error
      statusCode = 400;
      errorMessage = 'Invalid ID format';
    } else if (error.name === 'JsonWebTokenError') {
      // JWT error
      statusCode = 401;
      errorMessage = 'Invalid token';
    } else if (error.name === 'TokenExpiredError') {
      // JWT expired
      statusCode = 401;
      errorMessage = 'Token expired';
    }

    // Log the error with context
    this.logger.logError(
      error,
      `${req.method} ${req.url} - ${statusCode} - ${req.headers['x-request-id']}`
    );

    // Send response
    res.status(statusCode).json({
      success: false,
      error: {
        message: errorMessage,
        status: statusCode,
        // Include stack trace only in development
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
    });
  }
}
