import { Router } from 'express';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CropSuggestionController } from '../controllers/cropSuggestion.controller';
import { CropSuggestionValidation } from '../validations/cropSuggestion.validation';

export class CropSuggestionRouter {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      '/crop-suggestion',
      // authMiddleware,
      // ValidationMiddleware.validateQuery(CropSuggestionValidation.cropSuggestion),
      CropSuggestionController.generateCropSuggestion
    );
  }
}

export const cropSuggestionRouter = new CropSuggestionRouter().router;
