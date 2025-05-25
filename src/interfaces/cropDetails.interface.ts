import { Document } from 'mongoose';

export interface Season {
  planting: string;
  harvesting: string;
  duration: string;
}
export interface Climate {
  temperature: string;
  humidity: string;
  rainfall: string;
}
export interface Soil {
  types: string;
  ph: string;
  drainage: string;
}
export interface Water {
  requirements: string;
  irrigationSchedule: string;
  criticalStage: string[];
}

export interface Fertilizer {
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  Application: string[];
}

export interface Pest {
  name: string;
  symptoms: string;
  managements: string;
}

export interface Management {
  fertilizer: Fertilizer;
  weedManagement: string[];
  pestsManagement: Pest[];
  diseaseManagement: Pest[];
}

export interface Cultivation {
  title: string;
  guides: string[];
}
export interface Yield {
  average: string;
  potential: string;
  factorsAffectingYield: string;
}
export interface ProductionCosts {
  landPreparation: { cost: number; percentage: number };
  seeds: { cost: number; percentage: number };
  fertilizers: { cost: number; percentage: number };
  irrigation: { cost: number; percentage: number };
  plantProtection: { cost: number; percentage: number };
  labor: { cost: number; percentage: number };
  harvestingPostHarvest: { cost: number; percentage: number };
  total: number;
}
export interface ProfitabilityAnalysis {
  averageYield: number;
  averagePrice: number;
  grossRevenue: number;
  totalCost: number;
  netProfit: number;
  benefitCostRatio: number;
}

export interface Market {
  price: string;
  demand: string;
  storageLife: string;
  priceFluctuation: string;
}

export interface Economics {
  yield: Yield;
  productionCosts: ProductionCosts;
  market: Market;
  profitabilityAnalysis: ProfitabilityAnalysis;
}

export interface ICropDetails extends Document {
  name: string;
  scientificName: string;
  slug: string;
  climate: Climate;
  description: string;
  img: string;
  alternatives: string[];
  season: Season;
  soil: Soil;
  water: Water;
  cultivationGuides: Cultivation[];
  management: Management;
  harvesting: Cultivation[];
  economics: Economics;
}
