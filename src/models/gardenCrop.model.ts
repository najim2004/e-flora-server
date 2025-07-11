import { model, models, Schema } from 'mongoose';
import { IGardenCrop } from '../interfaces/gardenCrop.interface';

const gardenCropSchema = new Schema<IGardenCrop>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  gardenId: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
  cropName: String,
  scientificName: String,
  status: { type: String, enum: ['pending', 'active', 'removed'] },
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
  plantingGuideId: { type: Schema.Types.ObjectId, ref: 'PlantingGuide', },
});

export const GardenCrop = models.GardenCrop || model<IGardenCrop>('GardenCrop', gardenCropSchema);
