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
      const userId = req.user?._id;
      const { mode, cropName, gardenCropId, description } = req.body;

      if (!userId) throw new UnauthorizedError('User not authorized to perform this action');
      if (!req.file) throw new BadRequestError('No image file uploaded');

      // Immediately respond to the client
      res.status(200).json({
        message: 'Disease detection request received and is being processed.',
        success: true,
      });

      // Asynchronously call the service without awaiting
      this.diseaseDetectionService.detectDisease({
        userId,
        image: req.file,
        mode,
        cropName,
        gardenCropId,
        description,
      });
    } catch (error) {
      // This will catch synchronous errors like UnauthorizedError or BadRequestError
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
