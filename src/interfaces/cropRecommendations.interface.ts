import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface Weather {
  avgMaxTemp: number;
  avgMinTemp: number;
  avgHumidity: number;
  avgRainfall: number;
  avgWindSpeed: number;
  dominantWindDirection: string;
}
export interface Crop {
  icon: string;
  name: string;
  scientificName: string;
  description: string;
  match: number;
  cropDetails: {
    status: 'pending' | 'success' | 'failed';
    id?: Types.ObjectId;
    slug?: string;
  };
}
export interface CultivationTips {
  title: string;
  tips: string[];
}

export interface ICropRecommendations extends CommonInMongoose {
  crops: Crop[];
  cultivationTips: CultivationTips[];
  weathers: Weather[];
}
