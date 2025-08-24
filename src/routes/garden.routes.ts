import { Router } from 'express';
import { GardenController } from '../controllers/garden.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { ValidationMiddleware } from '../middlewares/validation.middleware';
import { GardenValidation } from '../validations/garden.validation';

export class GardenRouter {
  private router: Router;
  private gardenController: GardenController;
  constructor() {
    this.router = Router();
    this.gardenController = new GardenController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // crop adding to garden route
    this.router.post(
      '/add-crop/:id',
      authMiddleware,
      ValidationMiddleware.validateParams(GardenValidation.addToGarden),
      this.gardenController.addToGarden.bind(this.gardenController)
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}

export const gardenRouter = new GardenRouter().getRouter();
