import mongoose from 'mongoose';
import { IActivity } from '../interfaces/activity.model';

const activityDetailsSchema = new mongoose.Schema(
  {
    confidence: Number,
    treatment: String,
    location: String,
  },
  { _id: false }
);

const activitySchema = new mongoose.Schema<IActivity>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to User

    type: String,
    title: String,
    description: String,
    confidence: Number,
    date: Date,
    icon: String,
    details: activityDetailsSchema,
  },
  { timestamps: true }
);

export const Activity =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', activitySchema);
