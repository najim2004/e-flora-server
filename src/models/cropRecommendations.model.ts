import { model, models, Schema } from 'mongoose';
import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';

const CropRecommendationsSchema = new Schema<ICropRecommendations>(
  {
    crops: [
      {
        icon: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        match: { type: Number, required: true },
        cropDetailsId: { type: Schema.Types.ObjectId },
      },
    ],
    cultivationTips: [
      {
        title: { type: String, required: true },
        tips: { type: [String], required: true },
      },
    ],
    weathers: [
      {
        temperature: { type: Number, required: true },
        humidity: { type: Number, required: true },
        rainfall: { type: Number, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Export the model
export const CropRecommendations =
  models.CropRecommendationsSchema ||
  model<ICropRecommendations>('CropRecommendations', CropRecommendationsSchema);
