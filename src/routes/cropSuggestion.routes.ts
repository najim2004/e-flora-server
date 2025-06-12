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
      ValidationMiddleware.validateBody(CropSuggestionValidation.cropSuggestion),
      this.cropSuggestionController.generateCropSuggestion.bind(this.cropSuggestionController)
    );
    this.router.get(
      '/crop-suggestion/result/:id',
      authMiddleware,
      ValidationMiddleware.validateParams(DiseaseDetectionValidation.resultParam),
      this.cropSuggestionController.getSingleResult.bind(this.cropSuggestionController)
    );
    this.router.post(
      '/crop-suggestion/histories',
      authMiddleware,
      ValidationMiddleware.validateQuery(DiseaseDetectionValidation.historiesQuery),
      this.cropSuggestionController.getHistories.bind(this.cropSuggestionController)
    );
    this.router.get(
      '/crop-details/:slug',
      ValidationMiddleware.validateParams(CropSuggestionValidation.cropDetailsParam),
      this.cropSuggestionController.getCropDetails.bind(this.cropSuggestionController)
    );
  }
  public getRouter(): Router {
    return this.router;
  }
}

export const cropSuggestionRouter = new CropSuggestionRouter().getRouter();
