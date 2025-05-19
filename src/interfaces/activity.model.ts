import { Types } from 'mongoose';

export interface ActivityDetails {
  confidence: number;
  treatment: string;
  location: string;
}

export interface IActivity {
  _id?: string;
  user: Types.ObjectId; // user _id
  type: string;
  title: string;
  description: string;
  confidence: number;
  date: Date;
  icon: string;
  details: ActivityDetails;
  createdAt?: Date;
  updatedAt?: Date;
}
