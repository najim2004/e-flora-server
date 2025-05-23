import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';

export type CropSuggestionInput = Pick<
  ICropSuggestionHistory,
  'soilType' | 'farmSize' | 'irrigationAvailability' | 'location'
>;
