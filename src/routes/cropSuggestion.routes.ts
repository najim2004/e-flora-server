import { Router } from 'express';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CropSuggestionController } from '../controllers/cropSuggestion.controller';
import { CropSuggestionValidation } from '../validations/cropSuggestion.validation';
import { DiseaseDetectionValidation } from '../validations/diseaseDetection.validation';
import { FileUploadUtil } from '../utils/multer.util';

export class CropSuggestionRouter {
  private router: Router;
  private readonly uploadUtil: FileUploadUtil;
  private readonly cropSuggestionController: CropSuggestionController;
  constructor() {
    this.router = Router();
    this.uploadUtil = new FileUploadUtil('temp-uploads', 5, [
      'image/jpeg',
      'image/png',
      'image/jpg',
    ]);
    this.cropSuggestionController = new CropSuggestionController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      '/crop-suggestion',
      authMiddleware(),
      this.uploadUtil.uploadSingle('image'),
      ValidationMiddleware.validateBody(CropSuggestionValidation.cropSuggestion, req => {
        if (req.file?.filename) {
          this.uploadUtil.deleteFile(req.file.filename);
        }
      }),
      this.cropSuggestionController.generateCropSuggestion.bind(this.cropSuggestionController)
    );
    this.router.get(
      '/crop-suggestion/result/:id',
      authMiddleware({ accessTokenFirst: true }),
      ValidationMiddleware.validateParams(DiseaseDetectionValidation.resultParam),
      this.cropSuggestionController.getSingleResult.bind(this.cropSuggestionController)
    );
    this.router.post(
      '/crop-suggestion/histories',
      authMiddleware(),
      ValidationMiddleware.validateQuery(DiseaseDetectionValidation.historiesQuery),
      this.cropSuggestionController.getHistories.bind(this.cropSuggestionController)
    );
    this.router.get(
      '/crop-details/:slug',
      authMiddleware({ accessTokenFirst: true }),
      ValidationMiddleware.validateParams(CropSuggestionValidation.cropDetails),
      this.cropSuggestionController.getCropDetails.bind(this.cropSuggestionController)
    );
    this.router.post(
      '/crop-details/regenerate',
      authMiddleware(),
      ValidationMiddleware.validateBody(CropSuggestionValidation.regenerateCropDetails),
      this.cropSuggestionController.regenerateCropDetails.bind(this.cropSuggestionController)
    );
  }
  public getRouter(): Router {
    return this.router;
  }
}

export const cropSuggestionRouter = new CropSuggestionRouter().getRouter();
