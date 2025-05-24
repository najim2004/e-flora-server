import { model, models, Schema } from 'mongoose';
import { ICropSuggestionCache } from '../interfaces/cropSuggestionCache.interface';

const CropSuggestionCacheSchema = new Schema<ICropSuggestionCache>(
  {
    cacheKey: { type: String, required: true, unique: true },
    cropRecommendationsId: { type: Schema.Types.ObjectId, required: true },
    expiresAt: {
      type: Date,
      required: true,
      default: (): Date => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hr later
    },
  },
  { timestamps: true }
);

// ✅ TTL index set explicitly (this is the key fix)
CropSuggestionCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Export the model
export const CropSuggestionCache =
  models.CropSuggestionCache ||
  model<ICropSuggestionCache>('CropSuggestionCache', CropSuggestionCacheSchema);
