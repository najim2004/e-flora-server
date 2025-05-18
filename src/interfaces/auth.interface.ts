import { Document } from 'mongoose';

export interface IUser {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface ILoginCredentials {
  email: string;
  password: string;
}

export interface IAuthResponse {
  token: string;
  user: Omit<IUser, 'password'>;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export interface ITokenPayload {
  userId: string;
  role?: UserRole;
}
