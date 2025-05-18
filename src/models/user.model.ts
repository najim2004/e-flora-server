import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUserDocument, UserRole } from '../interfaces/auth.interface';
import { Logger } from '../utils/logger';

// User schema
const userSchema = new Schema<IUserDocument>(
  {
    fullName: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
        delete ret.__v;
      },
    },
  }
);

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified or new
  if (!this.isModified('password')) return next();
  const logger = new Logger('User.pre(save)');

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    logger.logError(error as Error, 'User.pre(save)');
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  const logger = new Logger('User.comparePassword');
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    logger.logError(error as Error, 'User.comparePassword');
    return false;
  }
};

// Create and export the User model
export const UserModel: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema);

// OOP wrapper class for User model operations
export class User {
  private static logger = new Logger('User');
  // Find by ID
  public static async findById(id: string): Promise<IUserDocument | null> {
    try {
      return await UserModel.findById(id);
    } catch (error) {
      this.logger.logError(error as Error, 'User.findById');
      return null;
    }
  }

  // Find by email
  public static async findByEmail(email: string): Promise<IUserDocument | null> {
    try {
      return await UserModel.findOne({ email });
    } catch (error) {
      this.logger.logError(error as Error, 'User.findByEmail');
      return null;
    }
  }

  // Create user
  public static async create(userData: IUserDocument): Promise<IUserDocument> {
    try {
      return await UserModel.create(userData);
    } catch (error) {
      this.logger.logError(error as Error, 'User.create');
      throw error;
    }
  }
}
