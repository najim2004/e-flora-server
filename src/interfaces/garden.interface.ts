import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';
import { LocationWithAddress } from '../types/common.types';

export type SoilType = 'loamy' | 'sandy' | 'clayey' | 'silty' | 'peaty' | 'chalky' | 'unknown';
export type Sunlight = 'full' | 'partial' | 'shade';
export type WaterSource =
  | 'tube-well'
  | 'tap'
  | 'rainwater'
  | 'storage'
  | 'manual'
  | 'uncertain'
  | 'unknown';
export type Purpose = 'eat' | 'sell' | 'decor' | 'educational' | 'mixed';
export type GardenType = 'rooftop' | 'balcony' | 'backyard' | 'indoor' | 'terrace' | 'field';
export type GardenerType = 'beginner' | 'intermediate' | 'expert';

export interface IGarden extends CommonInMongoose {
  userId: Types.ObjectId;
  name: string;
  image: {
    url: string;
    imageId: string;
  };
  description: string;
  location: LocationWithAddress;
  size: number;
  weather: Types.ObjectId;
  crops: Types.ObjectId[];
  tasks: Types.ObjectId[];
  activeCrops: number;
  pendingCrops: number;
  removedCrops: number;
  notes?: string;
  gardenType: GardenType;
  purpose: Purpose;
  sunlight: Sunlight;
  soilType: SoilType[];
  waterSource: WaterSource;
  gardenerType: GardenerType;
}
