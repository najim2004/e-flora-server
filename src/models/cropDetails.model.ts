import { model, models, Schema, Model } from 'mongoose';
import { ICropDetails } from '../interfaces/cropDetails.interface';

const cropDetailsSchema = new Schema<ICropDetails>({
  name: { type: String, required: true },
  scientificName: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },
  img: String,
  alternatives: [String],

  season: {
    planting: { type: String, required: true },
    harvesting: { type: String, required: true },
    duration: { type: String, required: true },
  },

  soil: {
    types: { type: String, required: true },
    ph: { type: String, required: true },
    drainage: { type: String, required: true },
  },
  climate: {
    temperature: { type: String, required: true }, //example: "20-30°C",
    humidity: { type: String, required: true }, //example: "60-80%",
    rainfall: { type: String, required: true }, //example: "1000-1500mm during growing season",
  },
  water: {
    requirements: { type: String, required: true },
    irrigationSchedule: String,
    criticalStage: [String],
  },

  cultivationGuides: [
    {
      title: { type: String, required: true },
      guides: [{ type: String, required: true }],
    },
  ],

  management: {
    fertilizer: {
      nitrogen: { type: String, required: true },
      phosphorus: { type: String, required: true },
      potassium: { type: String, required: true },
      Application: [{ type: String, required: true }],
    },
    weedManagement: [{ type: String, required: true }],
    pestsManagement: [
      {
        name: String,
        symptoms: String,
        managements: String,
      },
    ],
    diseaseManagement: [
      {
        name: String,
        symptoms: String,
        managements: String,
      },
    ],
  },

  harvesting: [
    {
      title: { type: String, required: true },
      guides: [{ type: String, required: true }],
    },
  ],

  economics: {
    yield: {
      average: { type: String, default: '' },
      potential: { type: String, default: '' },
      factorsAffectingYield: { type: String, default: '' },
    },

    productionCosts: {
      landPreparation: { cost: Number, percentage: Number },
      seeds: { cost: Number, percentage: Number },
      fertilizers: { cost: Number, percentage: Number },
      irrigation: { cost: Number, percentage: Number },
      plantProtection: { cost: Number, percentage: Number },
      labor: { cost: Number, percentage: Number },
      harvestingPostHarvest: { cost: Number, percentage: Number },
      total: Number,
    },

    market: {
      price: { type: String, default: '' },
      demand: { type: String, default: '' },
      storageLife: { type: String, default: '' },
      priceFluctuation: { type: String, default: '' },
    },

    profitabilityAnalysis: {
      averageYield: Number,
      averagePrice: Number,
      grossRevenue: Number,
      totalCost: Number,
      netProfit: Number,
      benefitCostRatio: Number,
    },
  },
});
// Modified pre-save hook
cropDetailsSchema.pre('save', async function (next) {
  try {
    // If scientificName is modified or new document
    if (this.isModified('scientificName') || this.isNew) {
      if (!this.scientificName) {
        throw new Error('Scientific name is required');
      }

      // Create base slug from scientific name
      const baseSlug = this.scientificName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

      let slug = baseSlug;
      let counter = 0;

      // Find unique slug
      while (true) {
        // Check if slug exists (excluding current document)
        const existingDoc = await (this.constructor as Model<ICropDetails>).findOne({
          slug,
          _id: { $ne: this._id },
        });

        if (!existingDoc) break;

        // If exists, increment counter and try again
        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      this.slug = slug;
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Fixed model export
export const CropDetails =
  models.CropDetails || model<ICropDetails>('CropDetails', cropDetailsSchema);
