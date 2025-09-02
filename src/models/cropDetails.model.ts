import { model, models, Schema, Model } from 'mongoose';
import { ICropDetails } from '../interfaces/cropDetails.interface';

const cropDetailsSchema = new Schema<ICropDetails>({
  name: { type: String, required: true },
  scientificName: { type: String, required: true },
  type: { type: String, required: true },
  variety: { type: String, required: false },
  description: { type: String, required: true },
  tags: [{ type: String, required: true }],
  difficultyLevel: { type: String, required: true },
  isPerennial: { type: Boolean, required: true },
  cropCycle: { type: String, required: false },
  // ...
  nutritionalAndCulinary: {
    // ...
    storageTips: { type: String, required: false },
  },
  economicAspects: {
    marketDemand: { type: String, required: true },
    seedSourcing: [
      {
        source: { type: String, required: true },
        details: { type: String, required: true },
      },
    ],
    costBreakdown: [
      {
        item: { type: String, required: true },
        cost: { type: Number, required: true },
        unit: { type: String, required: true },
        note: { type: String },
      },
    ],
  },
  sustainabilityTips: [{ type: String, required: true }],
  aestheticValue: {
    description: { type: String, required: true },
    tips: { type: String, required: true },
  },
  regionalSuitability: {
    suitableRegions: [{ type: String, required: true }],
    urbanGardeningNotes: { type: String, required: true },
  },
  funFacts: [{ type: String, required: true }],
  slug: { type: String, unique: true, sparse: true },
});

cropDetailsSchema.pre('save', async function (next) {
  try {
    if (this.isModified('scientificName') || this.isNew) {
      if (!this.get('scientificName')) {
        throw new Error('Scientific name is required');
      }

      const baseSlug = this.get('scientificName')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let slug = baseSlug;
      let counter = 0;

      while (true) {
        const existingDoc = await (this.constructor as Model<ICropDetails>).findOne({
          slug: slug,
          _id: { $ne: this._id },
        });

        if (!existingDoc) break;

        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      this.set('slug', slug);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Fixed model export
export const CropDetails =
  models.CropDetails || model<ICropDetails>('CropDetails', cropDetailsSchema);
