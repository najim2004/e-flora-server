import { Types } from 'mongoose';

export interface CommonInMongoose {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
