import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { BadRequestError } from '../utils/errors';
import { Logger } from '../utils/logger';

export class ValidationMiddleware {
  private static logger = new Logger('ValidationMiddleware');
  /**
   * Validates request body against provided schema
   * @param schema - Joi validation schema
   */
  public static validateBody(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessage = error.details.map(detail => detail.message).join(', ');

        this.logger.warn(`Request validation error: ${errorMessage}`);
        return next(new BadRequestError(errorMessage));
      }

      // Replace req.body with validated value
      req.body = schema.validate(req.body, { stripUnknown: true }).value;
      next();
    };
  }

  /**
   * Validates request params against provided schema
   * @param schema - Joi validation schema
   */
  public static validateParams(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessage = error.details.map(detail => detail.message).join(', ');

        this.logger.warn(`Params validation error: ${errorMessage}`);
        return next(new BadRequestError(errorMessage));
      }

      next();
    };
  }

  /**
   * Validates request query against provided schema
   * @param schema - Joi validation schema
   */
  public static validateQuery(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessage = error.details.map(detail => detail.message).join(', ');

        this.logger.warn(`Query validation error: ${errorMessage}`);
        return next(new BadRequestError(errorMessage));
      }

      next();
    };
  }
}
