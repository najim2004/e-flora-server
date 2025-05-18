import {
  IUser,
  ILoginCredentials,
  IAuthResponse,
  ITokenPayload,
} from '../interfaces/auth.interface';
import { UserModel } from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { BadRequestError, NotFoundError, InternalServerError } from '../utils/errors';
import { Logger } from '../utils/logger';

export class AuthService {
  private readonly JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  private logger = new Logger('AuthService');

  constructor(private readonly userModel: typeof UserModel = UserModel) {}

  public async register(userData: IUser): Promise<IAuthResponse> {
    try {
      const existingUser = await this.userModel.findOne({
        email: userData.email,
      });
      if (existingUser) {
        throw new BadRequestError('User with this email already exists');
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await this.userModel.create({
        ...userData,
        password: hashedPassword,
      });

      const token = this.generateToken({
        userId: user.id,
        role: user.role,
      });

      const userWithoutPassword = this.excludePassword(user.toJSON());

      this.logger.info(`New user registered: ${user.email}`);

      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      this.logger.logError(error as Error, 'AuthService.register');
      throw error;
    }
  }

  public async login(credentials: ILoginCredentials): Promise<IAuthResponse> {
    try {
      const user = await this.userModel.findOne({ email: credentials.email });
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new BadRequestError('Invalid password');
      }

      const token = this.generateToken({
        userId: user.id,
        role: user.role,
      });

      const userWithoutPassword = this.excludePassword(user.toJSON());

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

  private generateToken(payload: ITokenPayload): string {
    try {
      return jwt.sign(
        payload,
        this.JWT_SECRET as Secret,
        {
          expiresIn: this.JWT_EXPIRES_IN,
        } as SignOptions
      );
    } catch (error) {
      this.logger.logError(error as Error, 'AuthService.generateToken');
      throw new InternalServerError('Error generating authentication token');
    }
  }

  private excludePassword(user: IUser): Omit<IUser, 'password'> {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
