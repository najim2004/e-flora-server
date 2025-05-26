import { IDiseaseDetection } from '../interfaces/diseaseDetection.interface';
import { IDiseaseDetectionHistory } from '../interfaces/diseaseDetectionHistory.interface';

export interface InputDetectDisease
  extends Pick<IDiseaseDetectionHistory, 'cropName' | 'description'> {
  userId: string;
  image: Express.Multer.File;
}

export interface OutputDetectDisease
  extends Pick<
    IDiseaseDetection,
    'cropName' | 'description' | 'symptoms' | 'treatment' | 'causes' | 'preventiveTips'
  > {
  _id: string;
}
