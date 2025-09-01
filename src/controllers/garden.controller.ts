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

  public async getMyGarden(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req?.user;

    try {
      if (!user?._id || !user?.gardenId) throw new UnauthorizedError();
      const { _id: uId, gardenId } = user;
      this.logger.info(`getMyGarden request received`, { userId: user._id });
      const garden = await this.gardenService.getMyGarden({ uId, gardenId });
      this.logger.info(`Garden fetched successfully`, { userId: uId, gardenId });
      if (!garden) throw new BadRequestError('Garden not found');
      this.logger.debug('Returning garden data', { gardenId, userId: uId });
      res.status(200).json({
        data: garden,
        success: true,
        message: 'Garden fetched successfully',
      });
      this.logger.debug('Successfully returned garden data', { gardenId, userId: uId });
    } catch (error) {
      this.logger.error('Error in getMyGarden', {
        error,
        userId: user?._id,
        gardenId: user?.gardenId,
      });
      next(error);
    }
  }

  public async getActiveCrops(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req?.user;

    try {
      if (!user?._id) throw new UnauthorizedError('User not authenticated');

      this.logger.info(`getActiveCrops request received`, { userId: user._id });
      const activeCrops = await this.gardenService.getActiveCrops(user._id);

      res.status(200).json({
        data: activeCrops,
        success: true,
        message: 'Active crops fetched successfully',
      });
    } catch (error) {
      this.logger.error('Error in getActiveCrops', { error, userId: user?._id });
      next(error);
    }
  }
}
