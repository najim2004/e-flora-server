import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface ICrop extends CommonInMongoose {
  name: string; // e.g. "Tomato"
  scientificName: string;
  imageId: Types.ObjectId;
  difficulty: 'very easy' | 'easy' | 'medium' | 'hard';
  features?: string[]; // Max 3 short bullet features
  description?: string; // Short one-liner
  maturityTime?: string; // e.g. '90 days', '3 years'
  plantingSeason?: string; // e.g. 'Winter'
  sunlight?: string; // e.g. 'Full sun'
  waterNeed?: string; // e.g. 'Moderate'
  soilType: 'loamy' | 'sandy' | 'clayey' | 'silty' | 'peaty' | 'chalky';
  details: {
    status: 'pending' | 'success' | 'failed';
    detailsId?: Types.ObjectId;
  };
}
