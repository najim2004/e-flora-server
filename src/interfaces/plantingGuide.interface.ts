import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface Guide {
  title: string;
  description: string;
  steps: string[];
  note: string;
}

export interface IPlantingGuide extends CommonInMongoose {
  cropId: Types.ObjectId;
  gardenId: Types.ObjectId;
  guides: Guide[];
  totalSteps: number;
  currentStep: number;
  status: 'inprogress' | 'completed';
}
