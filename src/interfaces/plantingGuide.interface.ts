import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface PlantingGuideItem {
  _id?: string; // Mongoose _id
  title: string;
  description: string;
  instructions: string[];
  tips?: string;
  completed: boolean;
}

export interface IPlantingGuide extends CommonInMongoose {
  cropId: Types.ObjectId;
  gardenId: Types.ObjectId;
  plantingSteps: PlantingGuideItem[];
}
