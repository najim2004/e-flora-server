import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UpdateUserValidation } from '../validations/user.validation';

export class UserRouter {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Refresh user route (requires authentication)
    this.router.get('/refresh', authMiddleware, UserController.refreshUser);

    // Update user route (requires authentication and validation)
    this.router.put(
      '/update',
      authMiddleware,
      ValidationMiddleware.validateBody(UpdateUserValidation.update),
      UserController.updateUser
    );

    // Profile route (requires authentication)
    this.router.get('/profile', authMiddleware, UserController.getUserProfile);
  }
}

export const userRouter = new UserRouter().router;
