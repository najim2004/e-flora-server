import { ObjectId } from "mongoose";

export interface CommonInMongoose {
  _id: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}