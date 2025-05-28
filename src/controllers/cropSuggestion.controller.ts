import { NextFunction, Request, Response } from 'express';
import Logger from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';
import { CropSuggestionService } from '../services/cropSuggestion.service';

export class CropSuggestionController {
  private readonly logger = Logger.getInstance('CropSuggestion');
  private readonly cropSuggestionService: CropSuggestionService;
  constructor() {
    this.cropSuggestionService = new CropSuggestionService();
  }

  public async generateCropSuggestion(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) throw new UnauthorizedError('User not authenticated');
      res.status(200).json({
        message: 'Request received, processing crop suggestion',
        success: true,
      });
      this.cropSuggestionService.generateCropSuggestion(req.body, userId);
    } catch (error) {
      this.logger.logError(error as Error, 'CropSuggestionController');
    }
  }
}
