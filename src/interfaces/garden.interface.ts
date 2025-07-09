import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';
import { Location as Loc } from './cropSuggestionHistory.interface';

export interface Location extends Loc {
  country: string;
  state: string;
  city: string;
  zipCode: string;
}

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
  crops: Types.ObjectId[];
  tasks: Types.ObjectId[];
  activeCrops: number;
  pendingCrops: number;
  removedCrops: number;
}
