import { Document } from 'mongoose';

export interface IDiseaseDetection extends Document {
  cropName: string;
  diseaseName: string;
  description: string;
  embedded: number[];
  symptoms: string[];
  treatment: string[];
  causes: string[];
  preventiveTips: string[];
}
