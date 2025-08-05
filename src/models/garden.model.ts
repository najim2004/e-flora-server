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
    notes: String,
    gardenType: {
      type: String,
      enum: ['rooftop', 'balcony', 'backyard', 'indoor', 'terrace', 'field'],
    },
    purpose: { type: String, enum: ['eat', 'sell', 'decor', 'educational', 'mixed'] },
    sunlight: { type: String, enum: ['full', 'partial', 'shade'] },
    soilType: [
      { type: String, enum: ['loamy', 'sandy', 'clayey', 'silty', 'peaty', 'chalky', 'unknown'] },
    ],
    waterSource: {
      type: String,
      enum: ['tube-well', 'tap', 'rainwater', 'storage', 'manual', 'uncertain'],
    },
    gardenerType: { type: String, enum: ['beginner', 'intermediate', 'expert'] },
  },
  {
    timestamps: true,
  }
);

export const Garden = models.Garden || model<IGarden>('Garden', gardenSchema);
