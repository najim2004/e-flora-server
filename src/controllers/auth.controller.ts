import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { UserModel } from '../models/user.model';
import { Logger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';

export class AuthController {
  private static authService = new AuthService(UserModel);
  private static logger = new Logger('AuthController');

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      // Basic validation
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        throw new BadRequestError('Missing required fields: name, email, or password');
      }

      if (password.length < 6) {
        throw new BadRequestError('Password must be at least 6 characters');
      }

      // Log registration attempt
      this.logger.info(`Registration attempt for email: ${email}`);

      // Register user
      const result = await this.authService.register(req.body);

      // Log successful registration
      this.logger.info(`User registered successfully: ${email}`);

      // Return success
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      this.logger.error(
        `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      // Basic validation
      const { email, password } = req.body;

      if (!email || !password) {
        throw new BadRequestError('Missing required fields: email or password');
      }

      // Log login attempt
      this.logger.info(`Login attempt for email: ${email}`);

      // Login user
      const result = await this.authService.login(req.body);

      // Log successful login
      this.logger.info(`User logged in successfully: ${email}`);

      // Return success
      res.status(200).json({
        success: true,
        message: 'User logged in successfully',
        data: result,
      });
    } catch (error) {
      this.logger.error(
        `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      next(error);
    }
  }
}
