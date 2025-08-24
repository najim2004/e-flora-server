import { NextFunction, Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import Logger from '../utils/logger';
import { GardenService } from '../services/garden.service';

export class GardenController {
  private logger: Logger;
  private gardenService: GardenService;

  constructor() {
    this.logger = Logger.getInstance('GardenController');
    this.gardenService = new GardenService();
  }

  public async addToGarden(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req?.user;
    const { id: cropId } = req.params as { id: string };

    try {
      this.logger.info(`AddToGarden request received`, {
        userId: user?._id,
        gardenId: user?.gardenId,
        cropId,
      });

      if (!user?._id) {
        this.logger.warn('Unauthorized access attempt');
        throw new UnauthorizedError('User not authenticated');
      }

      if (!user?.gardenId || !cropId) {
        this.logger.warn('Bad request: missing credentials', { userId: user._id });
        throw new BadRequestError('Credentials are required');
      }

      const { gardenId, _id: uId } = user;
      this.logger.debug('Calling GardenService.addPlantToGarden', { gardenId, cropId, uId });

      const message = await this.gardenService.addPlantToGarden({ gardenId, cropId, uId });

      this.logger.info('Plant successfully added to garden', { userId: uId, cropId, gardenId });

      res.status(200).json({ message, success: true });
    } catch (error) {
      this.logger.error('Error in addToGarden', { error, userId: user?._id, cropId });
      next(error);
    }
  }
}
