import { model, models, Schema } from 'mongoose';
import { IGarden } from '../interfaces/garden.interface';

const gardenSchema = new Schema<IGarden>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    image: {
      type: {
        url: String,
        imageId: String,
      },
      default: {
        url: '/placeholder.svg',
        imageId: '',
      },
    },
    name: { type: String, default: 'Please name your garden' },
    description: { type: String, default: 'No description provided' },
    location: {
      type: {
        latitude: Number,
        longitude: Number,
        country: String,
        state: String,
        city: String,
        zipCode: String,
      },
      default: {},
    },
    size: { type: Number, default: 0 },
    weather: {
      type: Schema.Types.ObjectId,
      ref: 'Weather',
    },
    crops: { type: [{ type: Schema.Types.ObjectId, ref: 'GardenCrop' }], default: [] },
    tasks: { type: [{ type: Schema.Types.ObjectId, ref: 'Task' }], default: [] },
    activeCrops: { type: Number, default: 0 },
    pendingCrops: { type: Number, default: 0 },
    removedCrops: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    gardenType: {
      type: String,
      enum: ['rooftop', 'balcony', 'backyard', 'indoor', 'terrace', 'field'],
      default: 'rooftop',
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
      default: ['home-consumption'],
    },
    sunlight: { type: String, enum: ['full', 'partial', 'shade'], default: 'full' },
    soilType: {
      type: [
        { type: String, enum: ['loamy', 'sandy', 'clayey', 'silty', 'peaty', 'chalky', 'unknown'] },
      ],
      default: ['unknown'],
    },
    waterSource: {
      type: String,
      enum: [
        'automated',
        'manual',
        'rainwater',
        'tap-water',
        'well-water',
        'unknown',
      ],
      default: 'unknown',
    },
    gardenerType: {
      type: String,
      enum: ['beginner', 'intermediate', 'expert'],
      default: 'beginner',
    },
  },
  {
    timestamps: true,
  }
);

export const Garden = models.Garden || model<IGarden>('Garden', gardenSchema);
