import {Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface ActivityDetails {
  confidence: number;
  treatment: string;
  location: string;
}

export interface IActivity extends CommonInMongoose {
  user: Types.ObjectId;
  type: string;
  title: string;
  description: string;
  confidence: number;
  date: Date;
  icon: string;
  details: ActivityDetails;
}
