import mongoose from 'mongoose';
import { IFarm } from '../interfaces/farm.interface';

const equipmentAndResourcesSchema = new mongoose.Schema(
  {
    availableEquipment: [String],
    laborResources: {
      familyWorkers: String,
      hiredWorkers: String,
    },
  },
  { _id: false }
);

const farmSchema = new mongoose.Schema<IFarm>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to User

    farmName: String,
    location: String,
    farmSize: String,
    primarySoilType: String,
    irrigationType: String,
    conventional: Boolean,
    primaryCrops: [String],
    equipmentAndResources: equipmentAndResourcesSchema,
  },
  { timestamps: true }
);

export const Farm = mongoose.models.Farm || mongoose.model<IFarm>('Farm', farmSchema);
