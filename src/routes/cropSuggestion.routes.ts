import { Router } from 'express';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CropSuggestionController } from '../controllers/cropSuggestion.controller';
import { CropSuggestionValidation } from '../validations/cropSuggestion.validation';
import { DiseaseDetectionValidation } from '../validations/diseaseDetection.validation';

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
    this.router.get(
      '/crop-suggestion/result/:id',
      authMiddleware,
      ValidationMiddleware.validateParams(DiseaseDetectionValidation.resultParam),
      this.cropSuggestionController.getSingleResult
    );
    this.router.post(
      '/crop-suggestion/histories',
      authMiddleware,
      ValidationMiddleware.validateParams(DiseaseDetectionValidation.historiesQuery),
      this.cropSuggestionController.getHistories
    );
  }
  public getRouter(): Router {
    return this.router;
  }
}

export const cropSuggestionRouter = new CropSuggestionRouter().getRouter();
