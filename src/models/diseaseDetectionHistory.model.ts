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
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      url: {
        type: String,
        required: true,
      },
      id: {
        type: String,
        required: true,
      },
    },
    detectedDisease: {
      status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending',
      },
      id: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'DiseaseDetection',
      },
    },
  },
  {
    timestamps: true,
  }
);

export const DiseaseDetectionHistory =
  models.DiseaseDetectionHistory ||
  model<IDiseaseDetectionHistory>('DiseaseDetectionHistory', DiseaseDetectionHistorySchema);
