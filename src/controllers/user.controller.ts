import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import Logger from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';

export class UserController {
  private logger = Logger.getInstance('User');
  private userService: UserService;
  constructor() {
    this.userService = new UserService();
  }
  public async refreshUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get user ID from the request
      const userId = req.user?._id;
      if (!userId) {
        this.logger.error('Unauthorized access attempt in refreshUser');
        throw new UnauthorizedError();
      }
      this.logger.info(`Refreshing user data for userId: ${userId}`);
      // Fetch user from database
      const refreshedUser = await this.userService.findUserById(userId);
      this.logger.info(`User data refreshed successfully for userId: ${userId}`);
      // Return the token and basic user data
      res.status(200).json({
        success: true,
        message: 'User data fetch successfully',
        data: refreshedUser,
      });
    } catch (error) {
      this.logger.error(`Error in refreshUser: ${error instanceof Error && error.message}`);
      next(error);
    }
  }

  public async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        this.logger.info(`Refreshing user data for userId: ${userId}`);
        throw new UnauthorizedError();
      }
      const updateData = req.body;
      this.logger.info(`Updating user data for userId: ${userId}`);
      const updatedUser = await this.userService.updateUser(userId, updateData);
      this.logger.info(`User updated successfully for userId: ${userId}`);
      res.status(200).json({ message: 'User updated', user: updatedUser });
    } catch (error) {
      this.logger.error(`Error in updateUser: ${error instanceof Error && error.message}`);
      next(error);
    }
  }

  public async getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        this.logger.info(`Refreshing user data for userId: ${userId}`);
        throw new UnauthorizedError();
      }
      this.logger.info(`Fetching user profile for userId: ${userId}`);
      const userProfile = await this.userService.getProfile(userId);
      this.logger.info(`User profile retrieved successfully for userId: ${userId}`);
      res.status(200).json({ message: 'User profile retrieved', user: userProfile });
    } catch (error) {
      this.logger.error(`Error in getUserProfile: ${error instanceof Error && error.message}`);
      next(error);
    }
  }
}
