import { model, Schema, Document } from 'mongoose';
import { IPlantingGuide } from '../interfaces/plantingGuide.interface';

const plantingGuideSchema = new Schema<IPlantingGuide>({
  cropId: { type: Schema.Types.ObjectId, ref: 'CropDetails', required: true },
  gardenId: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
  plantingSteps: {
    type: [
      {
        title: { type: String, required: true },
        description: { type: String, required: true },
        instructions: { type: [String], default: [] },
        tips: { type: String },
        completed: { type: Boolean, default: false },
      },
    ],
    required: true,
    minlength: [1, 'Planting steps must have at least one step'],
  },
});

export const PlantingGuideModel = model<IPlantingGuide>('PlantingGuide', plantingGuideSchema);
