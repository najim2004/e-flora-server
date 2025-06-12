import { NextFunction, Request, Response } from 'express';
import Logger from '../utils/logger';
import { DiseaseDetectionService } from '../services/diseaseDetection.service';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class DiseaseDetectionController {
  private readonly logger: Logger;
  private readonly diseaseDetectionService: DiseaseDetectionService;

  constructor() {
    this.logger = Logger.getInstance('DiseaseDetection');
    this.diseaseDetectionService = new DiseaseDetectionService();
  }

  public detectDisease = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user?._id) throw new UnauthorizedError('User not authorized to perform this action');
      if (!req.file?.filename) throw new BadRequestError('No image file uploaded');

      res.status(200).json({
        message: 'Disease detection request received',
        success: true,
      });

      this.logger.info('Disease detection request received in DiseaseDetectionController');

      try {
        this.diseaseDetectionService.detectDisease({
          userId: req.user?._id,
          cropName: req.body.cropName,
          description: req.body.description || null,
          image: req.file,
        });
      } catch (error) {
        this.logger.logError(error as Error, 'Getting error from diseaseDetectionService file');
      }
    } catch (error) {
      next(error);
    }
  };
  public getSingleResult = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user?._id) throw new UnauthorizedError('User not authorized to perform this action');
      if (!req.params?.id) throw new BadRequestError('Resource not found');
      const result = await this.diseaseDetectionService.getSingleResult(
        req.user._id,
        req.params.id
      );
      res.status(200).json({
        success: true,
        message: 'Result fetched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
  public getHistories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?._id) throw new UnauthorizedError('User not authorized to perform this action');

      const histories = await this.diseaseDetectionService.getPaginatedHistory(
        req.user._id,
        req.body.limit,
        req.body.page
      );
      res.status(200).json({
        success: true,
        message: 'History fetched successfully',
        data: histories,
      });
    } catch (error) {
      next(error);
    }
  };
}
