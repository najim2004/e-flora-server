import { NextFunction, Request, Response } from 'express';
import Logger from '../utils/logger';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { CropSuggestionService } from '../services/cropSuggestion.service';
import { Garden } from '../models/garden.model';

export class CropSuggestionController {
  private readonly logger = Logger.getInstance('CropSuggestion');
  private readonly cropSuggestionService: CropSuggestionService;
  constructor() {
    this.cropSuggestionService = new CropSuggestionService();
  }

  public async generateCropSuggestion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      let garden = null;
      if (!user?._id) throw new UnauthorizedError('User not authenticated');
      if (!req.body.mode) throw new BadRequestError('Mode is required');
      if (req.body.mode == 'auto' && user?.gardenId) {
        garden = await Garden.findById(user?.gardenId)
          .select(
            'location sunlight soilType waterSource area gardenType gardenerType crops purpose'
          )
          .populate({
            path: 'crops',
            select: 'name',
          });
      }
      res.status(200).json({
        message: 'Request received, processing crop suggestion',
        success: true,
      });
      this.cropSuggestionService.generateCropSuggestion({ ...req.body, ...garden }, user?._id);
    } catch (error) {
      this.logger.logError(error as Error, 'CropSuggestion');
      next(error);
    }
  }

  public async getSingleResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) throw new UnauthorizedError('User not authenticated');
      const result = await this.cropSuggestionService.getOneHistory(req.params.id);
      if (!result) throw new NotFoundError('Not result found');
      res.status(200).json({
        message: 'Result fetched successfully',
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.logError(error as Error, 'CropSuggestion');
      next(error);
    }
  }
  public async getHistories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) throw new UnauthorizedError('User not authenticated');
      if (req.params?.id) throw new BadRequestError('Resource not found');
      const result = await this.cropSuggestionService.getHistories(
        userId,
        req.body?.page || 1,
        req.body?.limit || 10
      );
      if (!result) throw new NotFoundError('Not result found');
      res.status(200).json({
        message: 'Result fetched successfully',
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.logError(error as Error, 'CropSuggestion');
      next(error);
    }
  }
  public async getCropDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      if (!slug) throw new BadRequestError('Slug is required');

      const details = await this.cropSuggestionService.getCropDetails(slug);
      if (!details) throw new NotFoundError('Crop details not found');

      res.status(200).json({
        message: 'Crop details fetched successfully',
        success: true,
        data: details,
      });
    } catch (error) {
      this.logger.logError(error as Error, 'CropSuggestion');
      next(error);
    }
  }
}
