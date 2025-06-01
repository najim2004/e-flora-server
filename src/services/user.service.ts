import { IUser } from '../interfaces/user.interface';
import { User } from '../models/user.model';

export class UserService {
  public static async updateUser(userId: string, updateData: any): Promise<IUser> {
    try {
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true, // Return the updated document
        runValidators: true, // Ensure the update data is valid
      });

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return updatedUser;
    } catch (error) {
      throw new Error(
        `Error updating user: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  public static async findUserById(
    userId: string
  ): Promise<Pick<IUser, 'role' | 'email' | 'name' | '_id' | 'appPreferences' | 'profileImage'>> {
    try {
      const user = await User.findById(userId).select(
        '_id role name email profileImage appPreferences'
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error(
        `Error finding user: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }
  public static async getProfile(
    userId: string
  ): Promise<
    Omit<
      IUser,
      | 'password'
      | '__v'
      | 'createdAt'
      | 'updatedAt'
      | 'email'
      | 'profileImage'
      | 'bannerImage'
      | 'activities'
    >
  > {
    try {
      const user = await User.findById(userId).select('-password -__v');

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error(
        `Error finding user: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }
}
