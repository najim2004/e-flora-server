import { model, models, Schema } from 'mongoose';
import { IDiseaseDetectionHistory } from '../interfaces/diseaseDetectionHistory.interface';

const DiseaseDetectionHistorySchema = new Schema<IDiseaseDetectionHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    cropName: {
      type: String,
      trim: true,
    },
    garden: {
      type: Schema.Types.ObjectId,
      ref: 'Garden',
    },
    crop: {
      type: Schema.Types.ObjectId,
      ref: 'Crop',
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Image',
    },
    detectedDisease: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'DiseaseDetection',
    },
    cta: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

export const DiseaseDetectionHistory =
  models.DiseaseDetectionHistory ||
  model<IDiseaseDetectionHistory>('DiseaseDetectionHistory', DiseaseDetectionHistorySchema);
