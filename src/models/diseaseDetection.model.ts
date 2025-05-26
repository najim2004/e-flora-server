import { model, Schema, models } from 'mongoose';
import { IDiseaseDetection } from '../interfaces/diseaseDetection.interface';

const DiseaseDetectionSchema = new Schema<IDiseaseDetection>(
  {
    cropName: {
      type: String,
      required: true,
      trim: true,
    },
    diseaseName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    embedded: {
      type: [Number],
      required: true,
    },
    symptoms: {
      type: [String],
      required: true,
    },
    treatment: {
      type: [String],
      required: true,
    },
    causes: {
      type: [String],
      required: true,
    },
    preventiveTips: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const DiseaseDetection =
  models.DiseaseDetection || model<IDiseaseDetection>('DiseaseDetection', DiseaseDetectionSchema);
