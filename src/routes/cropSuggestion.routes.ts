import { Router } from 'express';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CropSuggestionController } from '../controllers/cropSuggestion.controller';
import { CropSuggestionValidation } from '../validations/cropSuggestion.validation';

export class CropSuggestionRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      '/crop-suggestion',
      authMiddleware,
      ValidationMiddleware.validateQuery(CropSuggestionValidation.cropSuggestion),
      CropSuggestionController.generateCropSuggestion
    );
  }
  public getRouter(): Router {
    return this.router;
  }
}

export const cropSuggestionRouter = new CropSuggestionRouter().getRouter();
