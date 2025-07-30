import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';
import { LocationWithAddress } from '../types/common.types';
import {
  GardenerType,
  GardenType,
  Purpose,
  SoilType,
  Sunlight,
  WaterSource,
} from './garden.interface';

export interface Weather {
  avgMaxTemp: number;
  avgMinTemp: number;
  avgHumidity: number;
  avgRainfall: number;
  avgWindSpeed: number;
  dominantWindDirection: string;
}
export type PlantType = 'vegetable' | 'fruit' | 'flower' | 'herb' | 'tree' | 'ornamental';

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
