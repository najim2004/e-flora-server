import { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';
import { CropSuggestionService } from '../services/cropSuggestion.service';

export class CropSuggestionController {
  private static logger = Logger.getInstance('CropSuggestionController');
  private static cropSuggestionService: CropSuggestionService;
  constructor() {
    CropSuggestionController.cropSuggestionService = new CropSuggestionService();
  }

  public static async generateCropSuggestion(
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
      await CropSuggestionController.cropSuggestionService.generateCropSuggestion(req.body, userId);
    } catch (error) {
      CropSuggestionController.logger.logError(error as Error, 'CropSuggestionController');
    }
  }
}
