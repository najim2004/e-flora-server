import { model, Schema } from 'mongoose';
import { IPlantingGuide } from '../interfaces/plantingGuide.interface';

const plantingGuideSchema = new Schema<IPlantingGuide>({
  cropId: { type: Schema.Types.ObjectId, ref: 'CropDetails', required: true },
  gardenId: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
  plantingSteps: [
    {
      title: { type: String, required: true },
      description: { type: String, required: true },
      instructions: { type: [String], required: true },
      note: { type: String },
    },
  ],
  numberOfSteps: { type: Number },
  currentStep: { type: Number, default: 0 },
  status: { type: String, enum: ['inProgress', 'completed'], default: 'inProgress' },
});

// Add pre-save middleware to automatically set numberOfSteps
plantingGuideSchema.pre('save', function (next) {
  if (this.plantingSteps) {
    this.numberOfSteps = this.plantingSteps.length;
  }
  next();
});

export const PlantingGuideModel = model<IPlantingGuide>('PlantingGuide', plantingGuideSchema);
