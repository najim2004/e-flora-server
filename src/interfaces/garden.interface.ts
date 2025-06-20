import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';
import { Location } from './cropSuggestionHistory.interface';

export interface Weather {
  maxTemp: number;
  minTemp: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  dominantWindDirection: string;
  date: Date;
}

export interface IGarden extends CommonInMongoose {
  userId: Types.ObjectId;
  name: string;
  description: string;
  location: Location;
  size: number;
  Weather: Weather;
  crops: string[];
  activeCrops:number;
  pendingCrops:number;
  removedCrops:number;
}
