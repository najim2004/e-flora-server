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
        note: { type: String },
      },
    ],
    required: true,
    minlength: [1, 'Planting steps must have at least one step'],
  },
  numberOfSteps: { type: Number, default: 0 },
  currentStep: { type: Number, default: 0 },
  status: { type: String, enum: ['inProgress', 'completed'], default: 'inProgress' },
});

// ✅ Type-safe pre-save middleware
plantingGuideSchema.pre<IPlantingGuide & Document>('save', function (next) {
  this.numberOfSteps = this.plantingSteps?.length || 0;
  next();
});

export const PlantingGuideModel = model<IPlantingGuide>('PlantingGuide', plantingGuideSchema);
