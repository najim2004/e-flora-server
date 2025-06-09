import { model, models, Schema } from 'mongoose';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';

const CropSuggestionHistorySchema = new Schema<ICropSuggestionHistory>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    cacheKey: { type: String, required: true },
    // Additional fields for crop suggestion history
    soilType: { type: String, required: true },
    farmSize: { type: Number, required: true },
    irrigationAvailability: { type: String, required: true },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    cropRecommendationsId: {
      type: Schema.Types.ObjectId,
      ref: 'CropRecommendations',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
CropSuggestionHistorySchema.index({ cacheKey: 1 });

// Export the model
export const CropSuggestionHistory =
  models.CropSuggestionHistory ||
  model<ICropSuggestionHistory>('CropSuggestionHistory', CropSuggestionHistorySchema);
