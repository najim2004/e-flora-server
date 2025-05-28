import { ObjectId } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface IDiseaseDetectionHistory extends CommonInMongoose {
  userId: ObjectId;
  cropName: string;
  description: string;
  image: {
    url: string;
    id: string;
  };
  detectedDisease: {
    status: 'pending' | 'success' | 'failed';
    id?: ObjectId;
  };
}
