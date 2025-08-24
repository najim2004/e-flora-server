import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface IGardenCrop extends CommonInMongoose {
  userId: Types.ObjectId;
  garden: Types.ObjectId;
  cropName: string;
  description: string;
  scientificName: string;
  status: 'pending' | 'active' | 'removed';
  currentStage: 'sowing' | 'germination' | 'flowering' | 'maturing' | 'harvested' | 'unknown';
  plantingDate: Date;
  expectedHarvestDate: Date;
  healthScore: number;
  image: Types.ObjectId;
  tasks: Types.ObjectId[];
  plantingGuide: Types.ObjectId;
}
