import bcrypt from 'bcryptjs';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { BadRequestError, NotFoundError, InternalServerError } from '../utils/errors';
import Logger from '../utils/logger';
import { User } from '../models/user.model';
import { RegCredentials, LoginCredentials, AuthResponse, TokenPayload } from '../types/auth.types';
import 'dotenv';

export class AuthService {
  private logger: Logger;
  private userModel = User;
  constructor() {
    this.logger = Logger.getInstance('Auth');
  }

  public async register(userData: RegCredentials): Promise<boolean> {
    try {
      const existingUser = await this.userModel.findOne({
        email: userData.email,
      });
      if (existingUser) {
        throw new BadRequestError('User with this email already exists');
      }
      const user = await this.userModel.create(userData);

      this.logger.info(`New user registered: ${user.email}`);

      return !!user;
    } catch (error) {
      this.logger.logError(error as Error, 'AuthService.register');
      throw error;
    }
  }

  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const user = await this.userModel
        .findOne({ email: credentials.email })
        .select('_id role name email profileImage appPreferences password garden');
      if (!user) {
        throw new NotFoundError('User not found');
      }
      const { password, ...userWithoutPassword } = user?.toObject();

      const isPasswordValid = await bcrypt.compare(credentials.password, password);
      if (!isPasswordValid) {
        throw new BadRequestError('Invalid password');
      }

      const token = this.generateToken({
        _id: user._id,
        email: user.email,
        role: user.role,
        gardenId: user.garden?.toString() || '',
      });

      this.logger.info(`User logged in: ${user.email}`);

      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      this.logger.logError(error as Error, 'AuthService.login');
      throw error;
    }
  }

  private generateToken(payload: TokenPayload): string {
    try {
      return jwt.sign(
        payload,
        process.env.JWT_SECRET as Secret,
        {
          expiresIn: process.env.JWT_EXPIRES_IN || 1000 * 60 * 60 * 24 * 365,
        } as SignOptions
      );
    } catch (error) {
      this.logger.logError(error as Error, 'AuthService.generateToken');
      throw new InternalServerError('Error generating authentication token');
    }
  }
}
