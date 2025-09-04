import { CommonInMongoose } from './common.interface';

export interface IWeather extends CommonInMongoose {
  location: {
    city: string;
    country: string;
  };
  data: {
    maxTemp: number;
    minTemp: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
    dominantWindDirection: string;
  };
}
