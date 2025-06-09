import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthValidation } from '../validations/auth.validation';
import { ValidationMiddleware } from '../middlewares/validation.middleware';

export class AuthRouter {
  public router: Router;
  private readonly authController: AuthController;
  constructor() {
    this.authController = new AuthController();
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      '/register',
      ValidationMiddleware.validateBody(AuthValidation.register),
      this.authController.register.bind(this.authController)
    );

    this.router.post(
      '/login',
      ValidationMiddleware.validateBody(AuthValidation.login),
      this.authController.login.bind(this.authController)
    );

    this.router.post('/logout', this.authController.logout.bind(this.authController));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export const authRouter = new AuthRouter().getRouter();
