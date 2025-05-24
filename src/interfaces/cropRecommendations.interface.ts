import { Document, Types } from 'mongoose';

export interface Weather {
  avgMaxTemp: number;
  avgMinTemp: number;
  avgHumidity: number;
  avgRainfall: number;
  avgWindSpeed: number;
  dominantWindDirection: string;
}
export interface Crops {
  icon: string;
  name: string;
  description: string;
  match: number;
  cropDetailsId?: Types.ObjectId;
}
export interface CultivationTips {
  title: string;
  tips: string[];
}

export interface ICropRecommendations extends Document {
  crops: Crops[];
  cultivationTips: CultivationTips[];
  weathers: Weather[];
}
