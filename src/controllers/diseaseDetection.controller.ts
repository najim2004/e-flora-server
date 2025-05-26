import { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { DiseaseDetectionService } from '../services/diseaseDetection.service';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class DiseaseDetectionController {
  private static logger: Logger;
  private static diseaseDetectionService: DiseaseDetectionService;
  constructor() {
    DiseaseDetectionController.logger = Logger.getInstance('DiseaseDetectionController');
    DiseaseDetectionController.diseaseDetectionService = new DiseaseDetectionService();
  }
  public static detectDisease(req: Request, res: Response, _next: NextFunction): void {
    if (!req.user?._id) throw new UnauthorizedError('User not authorized to perform this action');
    if (!req.file?.filename) throw new BadRequestError('No image file uploaded');
    res.status(200).json({
      message: 'Disease detection request received',
      success: true,
    });
    DiseaseDetectionController.logger.info(
      'Disease detection request received in DiseaseDetectionController'
    );
    DiseaseDetectionController.diseaseDetectionService.detectDisease({
      userId: req.user?._id,
      cropName: req.body.cropName,
      description: req.body.description,
      image: req.file,
    });
  }
}
