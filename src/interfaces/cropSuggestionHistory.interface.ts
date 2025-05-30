import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface ICropSuggestionHistory extends CommonInMongoose {
  userId: Types.ObjectId;
  cacheKey: string;
  soilType: string;
  farmSize: number;
  irrigationAvailability: string;
  location: Location;
  cropRecommendationsId: Types.ObjectId;
}
