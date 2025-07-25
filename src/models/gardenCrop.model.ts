import { model, models, Schema } from 'mongoose';
import { IGardenCrop } from '../interfaces/gardenCrop.interface';

const gardenCropSchema = new Schema<IGardenCrop>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gardenId: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
    cropName: { type: String, required: true },
    scientificName: String,
    status: {
      type: String,
      enum: ['pending', 'active', 'removed'],
      default: 'pending',
    },
    currentStage: {
      type: String,
      enum: ['sowing', 'germination', 'flowering', 'maturing', 'harvested'],
    },
    plantingDate: Date,
    expectedHarvestDate: Date,
    healthScore: Number,
    image: {
      url: String,
      id: String,
    },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    plantingGuideId: { type: Schema.Types.ObjectId, ref: 'PlantingGuide' },
  },
  {
    timestamps: true,
  }
);

// Update garden.crops[] only if crop is newly added (avoid infinite loop)
gardenCropSchema.post('save', async function (doc, next) {
  try {
    const { Garden } = await import('./garden.model');
    const garden = await Garden.findById(doc.gardenId);
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
