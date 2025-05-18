import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthValidation } from '../validations/auth.validation';
import { ValidationMiddleware } from '../middlewares/validation.middleware';

export class AuthRouter {
  public router: Router;
  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Register endpoint with validation
    this.router.post(
      '/register',
      ValidationMiddleware.validateBody(AuthValidation.register),
      (req, res, next) => AuthController.register(req, res, next)
    );

    // Login endpoint with validation
    this.router.post(
      '/login',
      ValidationMiddleware.validateBody(AuthValidation.login),
      (req, res, next) => AuthController.login(req, res, next)
    );
  }
}
