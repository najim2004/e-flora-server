import { Document, ObjectId } from 'mongoose';

export interface IDiseaseDetectionHistory extends Document {
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
