import { model, Schema, models } from 'mongoose';
import { IImage } from '../interfaces/image.interface';

const imageSchema = new Schema<IImage>({
  url: { type: String, required: true },
  imageId: { type: String, required: true },
  index: String,
});

export const Image = models.Image || model<IImage>('Image', imageSchema);
