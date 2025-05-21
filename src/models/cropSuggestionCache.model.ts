import { model, models, Schema } from 'mongoose';
import { ICropSuggestionCache } from '../interfaces/cropSuggestionCache.interface';

const CropSuggestionCacheSchema = new Schema<ICropSuggestionCache>(
  {
    geoHash: { type: String, required: true },
    soilType: { type: String, required: true },
    farmSize: { type: Number, required: true },
    irrigationAvailability: { type: String, required: true },
    cropRecommendationsId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// Export the model
export const CropSuggestionCache =
  models.CropSuggestionCacheSchema ||
  model<ICropSuggestionCache>('CropSuggestionCache', CropSuggestionCacheSchema);
