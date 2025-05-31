import { CommonInMongoose } from './common.interface';

export interface IDiseaseDetection extends CommonInMongoose {
  cropName: string;
  diseaseName: string;
  description: string;
  embedded: number[];
  symptoms: string[];
  treatment: string[];
  causes: string[];
  preventiveTips: string[];
}
