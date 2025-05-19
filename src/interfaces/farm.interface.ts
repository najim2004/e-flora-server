import { Types } from 'mongoose';

export interface LaborResources {
  familyWorkers: string;
  hiredWorkers: string;
}

export interface EquipmentAndResources {
  availableEquipment: string[];
  laborResources: LaborResources;
}

export interface IFarm {
  _id?: string;
  user: Types.ObjectId; // user _id
  farmName: string;
  location: string;
  farmSize: string;
  primarySoilType: string;
  irrigationType: string;
  conventional: boolean;
  primaryCrops: string[];
  equipmentAndResources: EquipmentAndResources;
  createdAt?: Date;
  updatedAt?: Date;
}
