import { model, models, Schema } from 'mongoose';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';

const CropSuggestionHistorySchema = new Schema<ICropSuggestionHistory>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    soilType: { type: String, required: true },
    farmSize: { type: Number, required: true },
    irrigationAvailability: { type: String, required: true },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    cropRecommendationsId: { type: Schema.Types.ObjectId, required: true },
  },
  {
    timestamps: true,
  }
);

// Export the model
export const CropSuggestionHistory =
  models.CropSuggestionHistory ||
  model<ICropSuggestionHistory>('CropSuggestionHistory', CropSuggestionHistorySchema);
