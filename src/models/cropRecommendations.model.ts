import { model, models, Schema } from 'mongoose';
import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';

const CropRecommendationsSchema = new Schema<ICropRecommendations>(
  {
    crops: [
      {
        _id: false, // ✅ Disable _id for each crop item
        icon: { type: String, required: true },
        name: { type: String, required: true },
        scientificName: { type: String, required: true },
        description: { type: String, required: true },
        match: { type: Number, required: true },
        cropDetails: {
          status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
          id: { type: Schema.Types.ObjectId, ref: 'CropDetails' },
          slug: { type: String },
        },
      },
    ],
    cultivationTips: [
      {
        _id: false, // ✅ Disable _id for each tip item
        title: { type: String, required: true },
        tips: { type: [String], required: true },
      },
    ],
    weathers: [
      {
        _id: false, // ✅ Disable _id for each weather item
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
