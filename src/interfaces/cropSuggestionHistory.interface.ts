import { Types } from 'mongoose';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface ICropSuggestionHistory {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  soilType: string;
  farmSize: number;
  irrigationAvailability: string;
  location: Location;
  cropRecommendationsId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
