import { model, models, Schema } from 'mongoose';
import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';

const CropRecommendationsSchema = new Schema<ICropRecommendations>(
  {
    crops: [
      {
        icon: { type: String, required: true },
        name: { type: String, required: true },
        scientificName: { type: String, required: true },
        description: { type: String, required: true },
        match: { type: Number, required: true },
        cropDetailsId: { type: Schema.Types.ObjectId },
        detailsSlug: { type: String },
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
        avgMaxTemp: { type: Number, required: true },
        avgMinTemp: { type: Number, required: true },
        avgHumidity: { type: Number, required: true },
        avgRainfall: { type: Number, required: true },
        avgWindSpeed: { type: Number, required: true },
        dominantWindDirection: { type: String, required: true },
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
