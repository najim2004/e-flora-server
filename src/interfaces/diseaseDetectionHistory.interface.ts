import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface IDiseaseDetectionHistory extends CommonInMongoose {
  userId: Types.ObjectId;
  cropName: string;
  description: string;
  image: Types.ObjectId;
  garden: Types.ObjectId;
  crop: Types.ObjectId;
  detectedDisease: Types.ObjectId;
  cta:boolean;
}
