import { Router } from 'express';
import { DiseaseDetectionController } from '../controllers/diseaseDetection.controller';
import { DiseaseDetectionValidation } from '../validations/diseaseDetection.validation';
import { FileUploadUtil } from '../utils/multer.util';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

/**
 * @class DiseaseDetectionRoutes
 * @description Defines and configures all routes related to crop disease detection
 */
export class DiseaseDetectionRoutes {
  private readonly router: Router;

  // File upload utility instance for handling temp uploads and cleanup
  private readonly uploadUtil: FileUploadUtil;

  constructor() {
    this.router = Router();
    this.uploadUtil = new FileUploadUtil(
      'temp-uploads', // Temp upload directory
      5, // Maximum file size (MB)
      ['image/jpeg', 'image/png', 'image/jpg'] // Allowed image MIME types
    );
    this.initializeRoutes();
  }

  /**
   * @method initializeRoutes
   * @description Registers the HTTP routes and their corresponding middlewares & controllers
   */
  private initializeRoutes(): void {
    this.router.post(
      '/disease-detection',

      /**
       * Middleware 0: Authentication middleware
       * - Ensures user is authenticated before proceeding
       * - If not authenticated, returns 401 Unauthorized
       */
      authMiddleware,

      /**
       * Middleware 1: Upload single image file from field named 'image'
       * - Stores image temporarily for validation and processing
       */
      this.uploadUtil.uploadSingle('image'),

      /**
       * Middleware 2: Validate incoming request body
       * - Validates cropName and description
       * - If validation fails, automatically removes uploaded file to free storage
       */
      ValidationMiddleware.validateBody(DiseaseDetectionValidation.diseaseDetection, req => {
        if (req.file?.filename) {
          this.uploadUtil.deleteFile(req.file.filename);
        }
      }),

      /**
       * Controller: Handle actual disease detection logic
       * - Assumes validated body and uploaded image are available in req
       */
      DiseaseDetectionController.detectDisease
    );
  }

  /**
   * @method getRouter
   * @returns {Router} Configured express router instance
   * @description Used to mount routes in the main application
   */
  public getRouter(): Router {
    return this.router;
  }
}

/**
 * @constant diseaseDetectionRoutes
 * @description Exported router instance to be used in main app router
 */
export const diseaseDetectionRoutes = new DiseaseDetectionRoutes().getRouter();
