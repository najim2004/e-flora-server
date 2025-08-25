import { IUser } from '../interfaces/user.interface';

export interface RegCredentials {
  email: string;
  password: string;
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  refreshToken: string;
  accessToken: string;
  user: Pick<IUser, '_id' | 'name' | 'email' | 'role' | 'appPreferences' | 'profileImage'>;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface TokenPayload {
  tokenName:string;
  _id: string;
  email: string;
  gardenId: string;
  role?: UserRole;
}
