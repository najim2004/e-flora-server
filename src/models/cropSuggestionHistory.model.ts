import { model, models, Schema } from 'mongoose';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';

const CropSuggestionHistorySchema = new Schema<ICropSuggestionHistory>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    gardenId: { type: Schema.Types.ObjectId, ref: 'Garden' },
    input: {
      location: {
        country: { type: String, required: true },
        state: { type: String, required: true },
        city: { type: String, required: true },
        zipCode: { type: String, required: true },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
      purpose: {
        type: String,
        enum: ['eat', 'sell', 'decor', 'educational', 'mixed'],
        required: true,
      },
      sunlight: { type: String, enum: ['full', 'partial', 'shade'], required: true },
      soilType: {
        type: String,
        enum: ['loamy', 'sandy', 'clayey', 'silty', 'peaty', 'chalky', 'unknown'],
        required: true,
      },
      area: { type: Number, required: true },
      waterSource: {
        type: String,
        enum: ['tube-well', 'tap', 'rainwater', 'storage', 'manual', 'uncertain'],
        required: true,
      },
      plantType: {
        type: String,
        enum: ['vegetable', 'fruit', 'flower', 'herb', 'tree', 'ornamental'],
        required: true,
      },
      gardenType: {
        type: String,
        enum: ['rooftop', 'balcony', 'backyard', 'indoor', 'terrace', 'field'],
        required: true,
      },
    },
    crops: { type: Schema.Types.ObjectId, ref: 'Crop', required: true },
    weather: {
      avgMaxTemp: { type: Number, required: true },
      avgMinTemp: { type: Number, required: true },
      avgHumidity: { type: Number, required: true },
      avgRainfall: { type: Number, required: true },
      avgWindSpeed: { type: Number, required: true },
      dominantWindDirection: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

// Export the model
export const CropSuggestionHistory =
  models.CropSuggestionHistory ||
  model<ICropSuggestionHistory>('CropSuggestionHistory', CropSuggestionHistorySchema);
