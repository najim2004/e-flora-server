import { Router } from 'express';
import { DiseaseDetectionController } from '../controllers/diseaseDetection.controller';
import { DiseaseDetectionValidation } from '../validations/diseaseDetection.validation';
import { FileUploadUtil } from '../utils/multer.util';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

export class DiseaseDetectionRoutes {
  private readonly router: Router;
  private readonly uploadUtil: FileUploadUtil;
  private readonly diseaseDetectionController: DiseaseDetectionController;
  constructor() {
    this.router = Router();
    this.uploadUtil = new FileUploadUtil('temp-uploads', 5, [
      'image/jpeg',
      'image/png',
      'image/jpg',
    ]);

    // Inject dependencies via constructor to controller
    this.diseaseDetectionController = new DiseaseDetectionController();

    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      '/disease-detection',
      authMiddleware,
      this.uploadUtil.uploadSingle('image'),
      ValidationMiddleware.validateBody(DiseaseDetectionValidation.diseaseDetection, req => {
        if (req.file?.filename) {
          this.uploadUtil.deleteFile(req.file.filename);
        }
      }),
      this.diseaseDetectionController.detectDisease
    );
    this.router.get(
      '/disease-detection/result/:id',
      authMiddleware,
      ValidationMiddleware.validateParams(DiseaseDetectionValidation.resultParam),
      this.diseaseDetectionController.getSpecificDetectedDiseaseResult
    );
    this.router.post(
      '/disease-detection/histories',
      authMiddleware,
      ValidationMiddleware.validateParams(DiseaseDetectionValidation.historiesQuery),
      this.diseaseDetectionController.getUserDetectedDiseaseHistories
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}

export const diseaseDetectionRouter = new DiseaseDetectionRoutes().getRouter();
