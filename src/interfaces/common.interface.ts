import { Document, Types } from 'mongoose';

export interface CommonInMongoose extends Document {
  _id: Types.ObjectId;
}
