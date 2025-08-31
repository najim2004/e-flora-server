import { CommonInMongoose } from './common.interface';

export interface GardenTypeSuitability {
  rooftop?: {
    suitable: boolean;
    notes?: string;
  };
  balcony?: {
    suitable: boolean;
    notes?: string;
  };
  land?: {
    suitable: boolean;
    notes?: string;
  };
}

export interface TemperatureRange {
  min: string;
  max: string;
}

export interface Soil {
  type: string;
  pH: string;
  drainage: string;
}

export interface ContainerGardening {
  canGrowInPots: boolean;
  potSize: string;
  potDepth: string;
  drainage: string;
}

export interface GrowthConditions {
  plantingSeason: string;
  plantingTime: string;
  climate: string;
  temperatureRange: TemperatureRange;
  humidityRequirement: string;
  sunlight: string;
  soil: Soil;
  spacingRequirements: string;
  containerGardening: ContainerGardening;
}

export interface Water {
  requirement: string;
  frequency: string;
  waterConservationTips: string[];
}

export interface Fertilizer {
  type: string;
  schedule: string;
}

export interface CareRequirements {
  water: Water;
  fertilizer: Fertilizer;
  pruning: string;
  support: string;
  spaceOptimizationTips: string[];
  toolsRequired: string[];
}

export interface CommonDisease {
  name: string;
  symptoms: string;
  treatment: string;
}

export interface CommonPest {
  name: string;
  symptoms: string;
  treatment: string;
}

export interface PestAndDiseaseManagement {
  commonDiseases: CommonDisease[];
  commonPests: CommonPest[];
}

export interface CompanionPlant {
  name: string;
  benefit: string;
}

export interface CompanionPlanting {
  companionPlants: CompanionPlant[];
  avoidNear: string[];
  notes?: string;
}

export interface NutritionalAndCulinary {
  nutritionalValue: string;
  healthBenefits: string;
  culinaryUses: string;
  storageTips: string;
}

export interface SeedSourcing {
  source: string;
  details: string;
}

export interface CostBreakdown {
  item: string;
  cost: number;
  unit: string;
  note?: string;
}

export interface EconomicAspects {
  marketDemand: string;
  seedSourcing: SeedSourcing[];
  costBreakdown: CostBreakdown[];
}

export interface AestheticValue {
  description: string;
  tips: string;
}

export interface RegionalSuitability {
  suitableRegions: string[];
  urbanGardeningNotes: string;
}

export interface GrowthAndHarvest {
  propagationMethods: string[];
  germinationTime: string;
  maturityTime: string;
  harvestTime: string;
  yieldPerPlant: string;
  harvestingTips: string[];
  pollinationType: string;
  seasonalAdjustments: {
    rooftop?: string;
    balcony?: string;
    land?: string;
  };
}

export interface ICropDetails extends CommonInMongoose {
  name: string;
  scientificName: string;
  type: string;
  variety: string;
  description: string;
  slug: string;
  tags: string[];
  difficultyLevel: string;
  isPerennial: boolean;
  cropCycle: string;
  gardenTypeSuitability: GardenTypeSuitability;
  growthConditions: GrowthConditions;
  careRequirements: CareRequirements;
  growthAndHarvest: GrowthAndHarvest;
  pestAndDiseaseManagement: PestAndDiseaseManagement;
  companionPlanting: CompanionPlanting;
  nutritionalAndCulinary: NutritionalAndCulinary;
  economicAspects: EconomicAspects;
  sustainabilityTips: string[];
  aestheticValue: AestheticValue;
  regionalSuitability: RegionalSuitability;
  funFacts: string[];
}
