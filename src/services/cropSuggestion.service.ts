import { CropDetails } from '../models/cropDetails.model';
import { CropRecommendations } from '../models/cropRecommendations.model';
import { CropSuggestionCache } from '../models/cropSuggestionCache.model';
import { CropSuggestionHistory } from '../models/cropSuggestionHistory.model';
import { CropSuggestionInput } from '../types/cropSuggestion.types';
import { Logger } from '../utils/logger';

export class CropSuggestionService {
  private logger = new Logger('CropSuggestionService');
  private cropSuggestionHistoryModel = CropSuggestionHistory;
  private cropSuggestionCacheModel = CropSuggestionCache;
  private cropRecommendationsModel = CropRecommendations;
  private cropDetailsModel = CropDetails;
  public async generateCropSuggestion(input: CropSuggestionInput): any {
    const { soilType, farmSize, irrigationAvailability, location } = input;
  }
}
