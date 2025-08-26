import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import Logger from '../utils/logger';
import { BadRequestError } from '../utils/errors';
import 'dotenv';

export class AuthController {
  private logger: Logger;
  private authService: AuthService;
  constructor() {
    this.logger = Logger.getInstance('Auth');
    this.authService = new AuthService();
  }

  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Basic validation
      const { email, password } = req.body;

      if (!email || !password) {
        throw new BadRequestError('Missing required fields: email or password');
      }

      // Log login attempt
      this.logger.info(`Login attempt for email: ${email}`);

      // Login user
      const { accessToken, refreshToken, user } = await this.authService.login(req.body);

      // Set tokens in cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: Number(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN)
          ? Number(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN)
          : 1000 * 60 * 60 * 24 * 365,
      });
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
        secure: false,
        maxAge: Number(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN)
          ? Number(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN)
          : 1000 * 60 * 60 * 24 * 365,
      });

      // Log successful login
      this.logger.info(`User logged in successfully: ${email}`);

      // Return success without sending token in body
      res.status(200).json({
        success: true,
        message: 'User logged in successfully',
        data: user,
      });
    } catch (error) {
      this.logger.error(`Login failed: ${error instanceof Error && error.message}`);
      next(error);
    }
  }
  public async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Clear the authentication cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
      res.clearCookie('accessToken', {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
        secure: false,
      });
      this.logger.info(`User logged out successfully`);

      res.status(200).json({
        success: true,
        message: 'User logged out successfully',
      });
    } catch (error) {
      this.logger.error(`Logout failed: ${error instanceof Error && error.message}`);
      next(error);
    }
  }
}
