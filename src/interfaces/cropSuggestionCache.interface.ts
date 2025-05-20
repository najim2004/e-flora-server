import { Types } from 'mongoose';

export interface ICropSuggestionCache {
  _id?: Types.ObjectId;
  geoHash: string;
  soilType: string;
  farmSize: number;
  irrigationAvailability: string;
  cropRecommendationsId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
