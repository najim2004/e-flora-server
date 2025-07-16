import { model, models, Schema } from 'mongoose';
import { IGarden } from '../interfaces/garden.interface';

const gardenSchema = new Schema<IGarden>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    description: String,
    location: {
      latitude: Number,
      longitude: Number,
      country: String,
      state: String,
      city: String,
      zipCode: String,
    },
    size: Number,
    weather: {
      maxTemp: Number,
      minTemp: Number,
      humidity: Number,
      rainfall: Number,
      windSpeed: Number,
      dominantWindDirection: String,
      date: Date,
    },
    crops: [{ type: Schema.Types.ObjectId, ref: 'GardenCrop' }],
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    activeCrops: Number,
    pendingCrops: Number,
    removedCrops: Number,
    type: String,
    soilType: [String],
    sunExposure: String,
    waterSource: String,
    notes: String,
  },
  {
    timestamps: true,
  }
);

export const Garden = models.Garden || model<IGarden>('Garden', gardenSchema);
