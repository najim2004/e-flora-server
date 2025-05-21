import { Document, Types } from 'mongoose';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface ICropSuggestionHistory extends Document {
  userId: Types.ObjectId;
  soilType: string;
  farmSize: number;
  irrigationAvailability: string;
  location: Location;
  cropRecommendationsId: Types.ObjectId;
}
