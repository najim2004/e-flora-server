import { model, models, Schema, Types } from 'mongoose';
import { ICrop } from '../interfaces/crop.interface';

const CropSchema = new Schema<ICrop>({
  name: { type: String, required: true },
  scientificName: { type: String, required: true },
  image: {
    type: Schema.Types.ObjectId,
    ref: 'Image',
    default: (): Types.ObjectId => new Types.ObjectId('68a20b129ffc8a285d720bc4'),
  },
  difficulty: { type: String, enum: ['very easy', 'easy', 'medium', 'hard'], required: true },
  features: { type: [String] },
  description: { type: String },
  maturityTime: { type: String },
  plantingSeason: { type: String },
  sunlight: { type: String },
  waterNeed: { type: String },
  soilType: {
    type: String,
    enum: ['loamy', 'sandy', 'clayey', 'silty', 'peaty', 'chalky'],
    required: true,
  },
  details: new Schema(
    {
      status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
      detailsId: { type: Schema.Types.ObjectId, ref: 'CropDetails' },
      slug: String,
    },
    { _id: true }
  ),
});

export const Crop = models.Crop || model<ICrop>('Crop', CropSchema);
