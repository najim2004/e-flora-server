import { model, models, Schema } from 'mongoose';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';

const CropSuggestionHistorySchema = new Schema<ICropSuggestionHistory>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    gardenId: { type: Schema.Types.ObjectId, ref: 'Garden' },
    input: {
      location: {
        country: { type: String },
        state: { type: String },
        city: { type: String },
        zipCode: { type: String },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
      purpose: {
        type: [String],
        enum: [
          'home-consumption',
          'commercial-selling',
          'aesthetic-decoration',
          'educational-learning',
          'medicinal-use',
          'shade-environmental',
        ],
        required: true,
      },
      sunlight: { type: String, enum: ['full', 'partial', 'shade'], required: true },
      soilType: {
        type: String,
        enum: ['loamy', 'sandy', 'clayey', 'silty', 'peaty', 'chalky', 'unknown'],
        required: false, // Made optional
      },
      area: { type: Number, required: true },
      waterSource: {
        type: String,
        enum: ['automated', 'manual', 'rainwater', 'tap-water', 'well-water', 'unknown'],
        required: true,
      },
      plantType: {
        type: [String],
        enum: ['vegetable', 'fruit', 'flower', 'herb', 'tree', 'ornamental'],
        required: true,
      },
      gardenType: {
        type: String,
        enum: ['rooftop', 'balcony', 'backyard', 'indoor', 'terrace', 'field'],
        required: true,
      },
    },
    weather: {
      avgMaxTemp: { type: Number, required: true },
      avgMinTemp: { type: Number, required: true },
      avgHumidity: { type: Number, required: true },
      avgRainfall: { type: Number, required: true },
      avgWindSpeed: { type: Number, required: true },
      dominantWindDirection: { type: String, required: true },
    },
    crops: [{ type: Schema.Types.ObjectId, ref: 'Crop', required: true }],
  },
  {
    timestamps: true,
  }
);

// Export the model
export const CropSuggestionHistory =
  models.CropSuggestionHistory ||
  model<ICropSuggestionHistory>('CropSuggestionHistory', CropSuggestionHistorySchema);
