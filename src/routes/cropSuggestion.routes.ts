import { Router } from 'express';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CropSuggestionController } from '../controllers/cropSuggestion.controller';
import { CropSuggestionValidation } from '../validations/cropSuggestion.validation';

export class CropSuggestionRouter {
  private router: Router;
  private readonly cropSuggestionController: CropSuggestionController;
  constructor() {
    this.router = Router();
    this.cropSuggestionController = new CropSuggestionController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      '/crop-suggestion',
      authMiddleware,
      ValidationMiddleware.validateQuery(CropSuggestionValidation.cropSuggestion),
      this.cropSuggestionController.generateCropSuggestion
    );
  }
  public getRouter(): Router {
    return this.router;
  }
}

export const cropSuggestionRouter = new CropSuggestionRouter().getRouter();
