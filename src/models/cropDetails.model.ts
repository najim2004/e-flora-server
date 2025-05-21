import { model, models, Schema } from 'mongoose';

const cropDetailsSchema = new Schema({
  name: { type: String, required: true },
  scientificName: { type: String, required: true },
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

export const CropDetails = models.cropDetailsSchema || model('CropDetails', cropDetailsSchema);
