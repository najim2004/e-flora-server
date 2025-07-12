import { LocationWithAddress } from './common.types';

export type SoilType = 'loamy' | 'sandy' | 'clayey' | 'silty' | 'peaty' | 'chalky' | 'unknown';

export type Sunlight = 'full' | 'partial' | 'shade';

export type WaterSource = 'tube-well' | 'tap' | 'rainwater' | 'storage' | 'manual' | 'uncertain';

export type Purpose = 'eat' | 'sell' | 'decor' | 'educational' | 'mixed';

export interface CropSuggestionInput {
  // for manual mode
  location: LocationWithAddress;
  image?: string;
  area?: number;
  soilType?: SoilType;
  sunlight?: Sunlight;
  waterSource?: WaterSource;
  purpose?: Purpose;
  currentCrops?: string[];

  // for auto mode
  gardenId?: string;
}
