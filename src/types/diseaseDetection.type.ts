import { IDiseaseDetection } from '../interfaces/diseaseDetection.interface';
import { IDiseaseDetectionHistory } from '../interfaces/diseaseDetectionHistory.interface';

export interface InputDetectDisease {
  userId: string;
  image: Express.Multer.File;
  mode: 'MANUAL' | 'GARDEN_CROP';
  cropName?: string;
  gardenCropId?: string;
  description?: string;
}

export interface OutputDetectDisease
  extends Pick<
    IDiseaseDetection,
    | 'cropName'
    | 'description'
    | 'symptoms'
    | 'treatment'
    | 'causes'
    | 'preventiveTips'
    | 'diseaseName'
  > {
  _id: string;
}

export type DiseaseDetectionStatus =
  | 'initiated'
  | 'analyzing'
  | 'generatingData'
  | 'savingToDB'
  | 'completed'
  | 'failed';

export interface DiseaseDetectionProgressPayload {
  readonly userId: string;
  readonly status: DiseaseDetectionStatus;
  readonly progress: number;
  readonly message?: string;
}

export interface DiseaseDetectionResultPayload
  extends Omit<
    IDiseaseDetectionHistory,
    'createdAt' | 'updatedAt' | 'detectedDisease' | '_id' | 'userId'
  > {
  _id: string;
  diseaseDetails: OutputDetectDisease;
}
