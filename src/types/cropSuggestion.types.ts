import {
  GardenerType,
  GardenType,
  PlantType,
  Purpose,
  SoilType,
  Sunlight,
  WaterSource,
} from '../interfaces/cropSuggestionHistory.interface';
import { LocationWithAddress } from './common.types';
export interface CropSuggestionInput {
  //common fields
  plantType: PlantType;
  mode: 'manual' | 'auto';
  avoidCurrentCrops:boolean;

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
