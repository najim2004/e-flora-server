import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface PlantingGuideItem {
  title: string;
  description: string;
  instructions: string[];
  note: string;
}

export interface IPlantingGuide extends CommonInMongoose {
  cropId: Types.ObjectId;
  gardenId: Types.ObjectId;
  plantingSteps: PlantingGuideItem[];
  numberOfSteps: number;
  currentStep: number;
  status: 'inProgress' | 'completed';
}
