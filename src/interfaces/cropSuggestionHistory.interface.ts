import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';
import { LocationWithAddress } from '../types/common.types';

export interface Weather {
  avgMaxTemp: number;
  avgMinTemp: number;
  avgHumidity: number;
  avgRainfall: number;
  avgWindSpeed: number;
  dominantWindDirection: string;
}
export type SoilType = 'loamy' | 'sandy' | 'clayey' | 'silty' | 'peaty' | 'chalky' | 'unknown';

export type Sunlight = 'full' | 'partial' | 'shade';

export type WaterSource = 'tube-well' | 'tap' | 'rainwater' | 'storage' | 'manual' | 'uncertain';

export type Purpose = 'eat' | 'sell' | 'decor' | 'educational' | 'mixed';
export type PlantType = 'vegetable' | 'fruit' | 'flower' | 'herb' | 'tree' | 'ornamental';
export type GardenType = 'rooftop' | 'balcony' | 'backyard' | 'indoor' | 'terrace' | 'field';
export type GardenerType = 'beginner' | 'intermediate' | 'expert';

export interface ICropSuggestionHistory extends CommonInMongoose {
  userId: Types.ObjectId;
  gardenId?: Types.ObjectId;
  input: {
    location: LocationWithAddress;
    purpose: Purpose;
    sunlight: Sunlight;
    soilType: SoilType;
    area: number;
    waterSource: WaterSource;
    plantType: PlantType;
    gardenType: GardenType;
    gardenerType: GardenerType;
  };
  crops: Types.ObjectId[];
  weather: Weather;
}
