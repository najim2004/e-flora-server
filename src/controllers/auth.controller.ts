import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { Logger } from '../utils/logger';
import { BadRequestError } from '../utils/errors';

export class AuthController {
  private static authService = new AuthService();
  private static logger = Logger.getInstance('AuthController');

  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      await this.authService.register(req.body);

      // Log successful registration
      this.logger.info(`User registered successfully: ${email}`);

      // Return success
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
      });
    } catch (error) {
      this.logger.error(`Registration failed: ${error instanceof Error && error.message}`);
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Basic validation
      const { email, password } = req.body;

      if (!email || !password) {
        throw new BadRequestError('Missing required fields: email or password');
      }

      // Log login attempt
      this.logger.info(`Login attempt for email: ${email}`);

      // Login user
      const { token, user } = await this.authService.login(req.body);

      // Set token in cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Log successful login
      this.logger.info(`User logged in successfully: ${email}`);

      // Return success without sending token in body
      res.status(200).json({
        success: true,
        message: 'User logged in successfully',
        data: { user },
      });
    } catch (error) {
      this.logger.error(`Login failed: ${error instanceof Error && error.message}`);
      next(error);
    }
  }
}
