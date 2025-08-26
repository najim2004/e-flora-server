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
    plantingDate: Date,
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
// Duplicate prevent before save
gardenCropSchema.pre('save', async function (next) {
  try {
    const garden = await Garden.findById(this.garden);
    if (!garden) return next();

    // Check duplicate crop
    if (garden.crops.includes(this._id)) {
      return next(new Error('Duplicate crop not allowed in this garden'));
    }

    // If not duplicate → update garden now
    garden.crops.push(this._id);
    adjustCropCount(garden, this.status, 1);
    await garden.save();
    next();
  } catch (err) {
    next(err as Error);
  }
});

// Status change handling
gardenCropSchema.post('findOneAndUpdate', async function (doc, next) {
  try {
    if (!doc) return next?.();

    const update = this.getUpdate() as { status?: string };
    const newStatus = update?.status;
    const oldStatus = doc.status;

    if (newStatus && newStatus !== oldStatus) {
      const garden = await Garden.findById(doc.garden);
      if (!garden) return next?.();

      adjustCropCount(garden, oldStatus, -1);
      adjustCropCount(garden, newStatus, 1);

      await garden.save();
    }
  } catch (err) {
    console.error('Error in GardenCrop post-update:', err);
  }
  next?.();
});

export const GardenCrop = models.GardenCrop || model<IGardenCrop>('GardenCrop', gardenCropSchema);
