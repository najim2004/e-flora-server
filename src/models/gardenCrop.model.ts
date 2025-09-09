import { model, models, Schema, Types } from 'mongoose';
import { IGardenCrop } from '../interfaces/gardenCrop.interface';
import { Garden } from './garden.model';
import { IGarden } from '../interfaces/garden.interface';

const DEFAULT_IMAGE_ID = new Types.ObjectId('68a20b129ffc8a285d720bc4');

const gardenCropSchema = new Schema<IGardenCrop>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    garden: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
    cropName: { type: String, required: true },
    cropId: { type: Schema.Types.ObjectId, ref: 'Crop', required: true },
    scientificName: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'active', 'removed'], default: 'pending' },
    currentStage: { type: String, default: 'unknown' },
    plantedDate: Date,
    expectedHarvestDate: Date,
    healthScore: { type: Number, default: 0 },
    image: { type: Schema.Types.ObjectId, ref: 'Image', default: DEFAULT_IMAGE_ID },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    plantingGuide: { type: Schema.Types.ObjectId, ref: 'PlantingGuide' },
  },
  { timestamps: true }
);

// ----------- Helpers -------------
const adjustCropCount = (garden: IGarden, status: string, change: number): void => {
  if (status === 'pending') garden.pendingCrops = Math.max((garden.pendingCrops || 0) + change, 0);
  if (status === 'active') garden.activeCrops = Math.max((garden.activeCrops || 0) + change, 0);
  if (status === 'removed') garden.removedCrops = Math.max((garden.removedCrops || 0) + change, 0);
};

// ----------- Hooks ----------------
gardenCropSchema.pre('save', async function (next) {
  try {
    const garden = await Garden.findById(this.garden);
    if (!garden) {
      return next(new Error('Garden not found'));
    }

    if (this.isNew) {
      // Handle new crop
      adjustCropCount(garden, this.status, 1);
      if (!garden.crops.includes(this._id)) {
        garden.crops.push(this._id);
      }
    } else if (this.isModified('status')) {
      // Handle status change for existing crop
      const oldStatus = (await models.GardenCrop.findById(this._id))?.status;
      const newStatus = this.status;

      if (oldStatus && oldStatus !== newStatus) {
        adjustCropCount(garden, oldStatus, -1);
        adjustCropCount(garden, newStatus, 1);

        if (newStatus === 'active' && !this.plantedDate) {
          this.plantedDate = new Date();
        }
      }
    }

    await garden.save();
    next();
  } catch (err) {
    next(err as Error);
  }
});

export const GardenCrop = models.GardenCrop || model<IGardenCrop>('GardenCrop', gardenCropSchema);
