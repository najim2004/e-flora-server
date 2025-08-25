import { model, models, Schema, Types } from 'mongoose';
import { IGardenCrop } from '../interfaces/gardenCrop.interface';
import { Garden } from './garden.model';

const gardenCropSchema = new Schema<IGardenCrop>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    garden: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
    cropName: { type: String, required: true },
    scientificName: { type: String, required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      default: 'pending',
    },
    currentStage: {
      type: String,
      default: 'unknown',
    },
    plantingDate: Date,
    expectedHarvestDate: Date,
    healthScore: { type: Number, default: 0 },
    image: {
      type: Schema.Types.ObjectId,
      ref: 'Image',
      default: (): Types.ObjectId => new Types.ObjectId('68a20b129ffc8a285d720bc4'),
    },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    plantingGuide: { type: Schema.Types.ObjectId, ref: 'PlantingGuide' },
  },
  {
    timestamps: true,
  }
);

// Update garden.crops[] only if crop is newly added (avoid infinite loop)
gardenCropSchema.post('save', async function (doc, next) {
  try {
    const garden = await Garden.findById(doc.garden);
    if (garden && !garden.crops.includes(doc._id)) {
      garden.crops.push(doc._id);
      await garden.save();
    }
  } catch (error) {
    console.log('Error updating Garden with GardenCrop ID:', error);
  }
  next?.(); // call next if provided (for compatibility)
});

export const GardenCrop = models.GardenCrop || model<IGardenCrop>('GardenCrop', gardenCropSchema);
