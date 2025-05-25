import { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';
import { CropSuggestionService } from '../services/cropSuggestion.service';

export class CropSuggestionController {
  private static logger = new Logger('CropSuggestionController');
  private static cropSuggestionService = new CropSuggestionService();

  public static async generateCropSuggestion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) throw new UnauthorizedError('User not authenticated');
      const response = await CropSuggestionController.cropSuggestionService.generateCropSuggestion(
        req.body,
        userId
      );
      res.status(200).json({
        message: 'Crop suggestion generation started',
        response,
      });
    } catch (error) {
      CropSuggestionController.logger.logError(error as Error, 'CropSuggestionController');
    }
  }
}
