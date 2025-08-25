import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UpdateUserValidation } from '../validations/user.validation';

export class UserRouter {
  private router: Router;
  private userController: UserController;

  constructor() {
    this.userController = new UserController();
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Refresh user route (requires authentication)
    this.router.get(
      '/me',
      authMiddleware(),
      this.userController.refreshUser.bind(this.userController)
    );

    // Update user route (requires authentication and validation)
    this.router.put(
      '/update',
      authMiddleware(),
      ValidationMiddleware.validateBody(UpdateUserValidation.update),
      this.userController.updateUser.bind(this.userController)
    );

    // Profile route (requires authentication)
    this.router.get(
      '/profile',
      authMiddleware(),
      this.userController.getUserProfile.bind(this.userController)
    );
  }
  public getRouter(): Router {
    return this.router;
  }
}

export const userRouter = new UserRouter().getRouter();
