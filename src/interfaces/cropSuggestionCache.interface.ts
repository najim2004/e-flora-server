import { Document } from 'mongoose';
import { ICropSuggestionHistory } from './cropSuggestionHistory.interface';

type Picked = Pick<ICropSuggestionHistory, 'cacheKey' | 'cropRecommendationsId'>;

export interface ICropSuggestionCache extends Document, Picked {
  expiresAt: Date;
}
