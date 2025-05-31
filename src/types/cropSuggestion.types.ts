import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';

export type CropSuggestionInput = Pick<
  ICropSuggestionHistory,
  'soilType' | 'farmSize' | 'irrigationAvailability' | 'location'
>;
export type CropSuggestionStatus =
  | 'initiated'
  | 'analyzing'
  | 'generatingData'
  | 'savingToDB'
  | 'completed'
  | 'failed';

export interface CropSuggestionProgressUpdate {
  userId: string;
  status: CropSuggestionStatus;
  progress: number;
  message?: string;
}

export interface CropSuggestionOutput extends CropSuggestionInput {
  _id: string;
  recommendations: Omit<ICropRecommendations, 'createdAt' | 'updatedAt' | '_id'> & { _id: string };
}
