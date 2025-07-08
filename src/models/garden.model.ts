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
    Weather: {
      maxTemp: Number,
      minTemp: Number,
      humidity: Number,
      rainfall: Number,
      windSpeed: Number,
      dominantWindDirection: String,
      date: Date,
    },
    crops: [{ type: Schema.Types.ObjectId, ref: 'GardenCrop' }],
    activeCrops: Number,
    pendingCrops: Number,
    removedCrops: Number,
  },
  {
    timestamps: true,
  }
);

export const Garden = models.Garden || model<IGarden>('Garden', gardenSchema);
