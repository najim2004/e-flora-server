import { PlantType } from '../interfaces/cropSuggestionHistory.interface';
import {
  GardenerType,
  GardenType,
  Purpose,
  SoilType,
  Sunlight,
  WaterSource,
} from '../interfaces/garden.interface';
import { LocationWithAddress } from './common.types';
export interface CropSuggestionInput {
  //common fields
  plantType: PlantType;
  mode: 'manual' | 'auto';
  avoidCurrentCrops: boolean;

  // for manual mode
  location: LocationWithAddress;
  image?: Express.Multer.File;
  area?: number;
  soilType?: SoilType;
  sunlight?: Sunlight;
  waterSource?: WaterSource;
  purpose?: Purpose;
  currentCrops?: string[];
  gardenType: GardenType;
  gardenerType: GardenerType;

  // for auto mode
  gardenId?: string;
}

export interface CropName {
  name: string;
  scientificName: string;
}
export interface CropSuggestionProgressUpdate {
  userId: string;
  status: 'initiated' | 'analyzing' | 'generatingData' | 'savingToDB' | 'completed' | 'failed';
  progress: number;
  message?: string;
}
