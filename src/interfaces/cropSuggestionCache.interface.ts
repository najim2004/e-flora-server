import { ICropSuggestionHistory } from './cropSuggestionHistory.interface';
import { CommonInMongoose } from './common.interface';

type Picked = Pick<ICropSuggestionHistory, 'cacheKey' | 'cropRecommendationsId'>;

export interface ICropSuggestionCache extends CommonInMongoose, Picked {
  expiresAt: Date;
}
