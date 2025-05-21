import { Document, Types } from 'mongoose';

export interface ICropSuggestionCache extends Document {
  geoHash: string;
  soilType: string;
  farmSize: number;
  irrigationAvailability: string;
  cropRecommendationsId: Types.ObjectId;
}
