import { Document, Types } from 'mongoose';

export interface LaborResources {
  familyWorkers: string;
  hiredWorkers: string;
}

export interface EquipmentAndResources {
  availableEquipment: string[];
  laborResources: LaborResources;
}

export interface IFarm extends Document {
  user: Types.ObjectId;
  farmName: string;
  location: string;
  farmSize: string;
  primarySoilType: string;
  irrigationType: string;
  conventional: boolean;
  primaryCrops: string[];
  equipmentAndResources: EquipmentAndResources;
}
