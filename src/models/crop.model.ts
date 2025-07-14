import { model, models, Schema } from 'mongoose';
import { ICrop } from '../interfaces/crop.interface';

const CropSchema = new Schema<ICrop>({
  name: { type: String, required: true },
  imageId: { type: Schema.Types.ObjectId, required: true },
  difficulty: { type: String, enum: ['very easy', 'easy', 'medium', 'hard'], required: true },
  features: { type: [String] },
  description: { type: String },
  maturityTime: { type: String },
  plantingSeason: { type: String },
  sunlight: { type: String },
  waterNeed: { type: String },
  soilType: { type: String, enum: ['loamy', 'sandy', 'clayey', 'silty', 'peaty', 'chalky'], required: true },
});

export const Crop = models.Crop || model<ICrop>('Crop', CropSchema);
