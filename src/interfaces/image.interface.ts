import { CommonInMongoose } from "./common.interface";

export interface IImage extends CommonInMongoose{
    url:string;
    imageId:string;
    index:string;
}