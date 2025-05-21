import { Document, Types } from 'mongoose';

export interface ActivityDetails {
  confidence: number;
  treatment: string;
  location: string;
}

export interface IActivity extends Document {
  user: Types.ObjectId;
  type: string;
  title: string;
  description: string;
  confidence: number;
  date: Date;
  icon: string;
  details: ActivityDetails;
}
