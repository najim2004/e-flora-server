import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { BadRequestError } from '../utils/errors';
import Logger from '../utils/logger';

/**
 * ValidationMiddleware
 * ====================
 * Provides reusable middleware functions for validating
 * request body, params, and query using Joi schemas.
 * Supports optional cleanup callbacks to handle side effects,
 * such as deleting uploaded files on validation failure.
 */
export class ValidationMiddleware {
  private static logger = Logger.getInstance('ValidationMiddleware');

  /**
   * Validates request body against a Joi schema.
   * Optionally executes a cleanup callback if validation fails.
   *
   * @param schema Joi validation schema for the request body
   * @param onError Optional callback invoked with the request
   *                when validation fails (e.g., to cleanup files)
   * @returns Express middleware function
   */
  public static validateBody(schema: Joi.Schema, onError?: (req: Request) => void) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.body) {
        onError?.(req);
        return next(new BadRequestError('Invalid or missing request body'));
      }

      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        onError?.(req);
        const errorMessage = error.details.map(d => d.message).join(', ');
        this.logger.warn(`Body validation failed: ${errorMessage}`);
        return next(new BadRequestError(errorMessage));
      }

      req.body = value; // Assign sanitized and validated value
      next();
    };
  }

  /**
   * Validates request params against a Joi schema.
   *
   * @param schema Joi validation schema for request params
   * @returns Express middleware function
   */
  public static validateParams(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessage = error.details.map(d => d.message).join(', ');
        this.logger.warn(`Params validation failed: ${errorMessage}`);
        return next(new BadRequestError(errorMessage));
      }

      req.params = value; // Assign sanitized and validated params
      next();
    };
  }

  /**
   * Validates request query against a Joi schema.
   *
   * @param schema Joi validation schema for request query
   * @returns Express middleware function
   */
  public static validateQuery(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessage = error.details.map(d => d.message).join(', ');
        this.logger.warn(`Query validation failed: ${errorMessage}`);
        return next(new BadRequestError(errorMessage));
      }

      // Instead of this:
      // req.query = value;

      // Use this:
      Object.assign(req.query, value); // ✅ Updates existing object
      next();
    };
  }
}
