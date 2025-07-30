import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';
import { LocationWithAddress } from '../types/common.types';
export interface Weather {
  maxTemp: number;
  minTemp: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  dominantWindDirection: string;
  date: Date;
}

export type SoilType = 'loamy' | 'sandy' | 'clayey' | 'silty' | 'peaty' | 'chalky' | 'unknown';
export type Sunlight = 'full' | 'partial' | 'shade';
export type WaterSource = 'tube-well' | 'tap' | 'rainwater' | 'storage' | 'manual' | 'uncertain';
export type Purpose = 'eat' | 'sell' | 'decor' | 'educational' | 'mixed';
export type GardenType = 'rooftop' | 'balcony' | 'backyard' | 'indoor' | 'terrace' | 'field';
export type GardenerType = 'beginner' | 'intermediate' | 'expert';

export interface IGarden extends CommonInMongoose {
  userId: Types.ObjectId;
  name: string;
  description: string;
  location: LocationWithAddress;
  size: number;
  weather: Weather;
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
