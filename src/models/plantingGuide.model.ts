import { model, Schema, Types } from 'mongoose';
import { PlantingGuide } from '../interfaces/plantingGuide.interface';

const plantingGuideSchema = new Schema<PlantingGuide>({
  cropId: { type: Schema.Types.ObjectId, ref: 'CropDetails', required: true },
  gardenId: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
  plantingSteps: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    instructions: { type: [String], required: true },
    note: { type: String },
  }],
  numberOfSteps: { type: Number, required: true },
  currentStep: { type: Number, default: 0 },
  status: { type: String, enum: ['inProgress', 'completed'], default: 'inProgress' },
});

export const PlantingGuideModel = model<PlantingGuide>('PlantingGuide', plantingGuideSchema);
