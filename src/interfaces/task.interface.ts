import { Types } from 'mongoose';
import { CommonInMongoose } from './common.interface';

export interface ITask extends CommonInMongoose {
  userId: Types.ObjectId;
  gardenId: Types.ObjectId;
  cropId: Types.ObjectId;
  taskName: string;
  description: string;
  status: 'pending' | 'missed' | 'completed';
  dueDate: Date;
  completionDate: Date;
  priority: number;
  notes: string;
}
