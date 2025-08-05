import { model, models, Schema } from 'mongoose';
import { ITask } from '../interfaces/task.interface';

const taskSchema = new Schema<ITask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  gardenId: { type: Schema.Types.ObjectId, ref: 'Garden', required: true },
  cropId: { type: Schema.Types.ObjectId, ref: 'GardenCrop', required: true },
  taskName: String,
  description: String,
  status: { type: String, enum: ['pending', 'missed', 'completed'] },
  dueDate: Date,
  completionDate: Date,
  priority: Number,
  notes: String,
});
export const Task = models.Task || model<ITask>('Task', taskSchema);
