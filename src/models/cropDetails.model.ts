import { model, models, Schema, Model, Document } from 'mongoose';
import { ICropDetails } from '../interfaces/cropDetails.interface';

const cropDetailsSchema = new Schema<ICropDetails>({
  cropId: { type: Schema.Types.ObjectId, ref: 'Crop', required: true },
  name: { type: String, required: true },
  scientificName: { type: String, required: true },
  type: { type: String, required: true },
  variety: { type: String, required: true },
  description: { type: String, required: true },
  tags: [{ type: String, required: true }],
  difficultyLevel: { type: String, required: true },
  isPerennial: { type: Boolean, required: true },
  cropCycle: { type: String, required: true },
  gardenTypeSuitability: {
    rooftop: {
      suitable: { type: Boolean },
      notes: { type: String },
    },
    balcony: {
      suitable: { type: Boolean },
      notes: { type: String },
    },
    land: {
      suitable: { type: Boolean },
      notes: { type: String },
    },
  },
  growthConditions: {
    plantingSeason: { type: String, required: true },
    plantingTime: { type: String, required: true },
    climate: { type: String, required: true },
    temperatureRange: {
      min: { type: String, required: true },
      max: { type: String, required: true },
    },
    humidityRequirement: { type: String, required: true },
    sunlight: { type: String, required: true },
    soil: {
      type: { type: String, required: true },
      pH: { type: String, required: true },
      drainage: { type: String, required: true },
    },
    spacingRequirements: { type: String, required: true },
    containerGardening: {
      canGrowInPots: { type: Boolean, required: true },
      potSize: { type: String, required: true },
      potDepth: { type: String, required: true },
      drainage: { type: String, required: true },
    },
  },
  careRequirements: {
    water: {
      requirement: { type: String, required: true },
      frequency: { type: String, required: true },
      waterConservationTips: [{ type: String, required: true }],
    },
    fertilizer: {
      type: { type: String, required: true },
      schedule: { type: String, required: true },
    },
    pruning: { type: String, required: true },
    support: { type: String, required: true },
    spaceOptimizationTips: [{ type: String, required: true }],
    toolsRequired: [{ type: String, required: true }],
  },
  growthAndHarvest: {
    propagationMethods: [{ type: String, required: true }],
    germinationTime: { type: String, required: true },
    maturityTime: { type: String, required: true },
    harvestTime: { type: String, required: true },
    yieldPerPlant: { type: String, required: true },
    harvestingTips: [{ type: String, required: true }],
    pollinationType: { type: String, required: true },
    seasonalAdjustments: {
      rooftop: { type: String },
      balcony: { type: String },
      land: { type: String },
    },
  },
  pestAndDiseaseManagement: {
    commonDiseases: [
      {
        name: { type: String, required: true },
        symptoms: { type: String, required: true },
        treatment: { type: String, required: true },
      },
    ],
    commonPests: [
      {
        name: { type: String, required: true },
        symptoms: { type: String, required: true },
        treatment: { type: String, required: true },
      },
    ],
  },
  companionPlanting: {
    companionPlants: [
      {
        name: { type: String, required: true },
        benefit: { type: String, required: true },
      },
    ],
    avoidNear: [{ type: String, required: true }],
    notes: { type: String },
  },
  nutritionalAndCulinary: {
    nutritionalValue: { type: String, required: true },
    healthBenefits: { type: String, required: true },
    culinaryUses: { type: String, required: true },
    storageTips: { type: String, required: true },
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

cropDetailsSchema.post('save', async function (doc: Document & ICropDetails) {
  try {
    // Get the Crop model
    const Crop = models.Crop;

    if (!Crop) {
      throw new Error('Crop model not found');
    }

    // Update the related Crop document
    await Crop.findByIdAndUpdate(
      doc.cropId,
      {
        details: {
          status: 'success',
          detailsId: doc._id,
          slug: doc.slug,
        },
      },
      { new: true }
    );
  } catch (error) {
    console.error('Error updating Crop details:', error);
    // Since this is a post-save hook, we can't prevent the save
    // But we can log the error for monitoring
  }
});

// Fixed model export
export const CropDetails =
  models.CropDetails || model<ICropDetails>('CropDetails', cropDetailsSchema);
