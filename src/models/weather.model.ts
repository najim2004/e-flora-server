import { models, Schema, model } from 'mongoose';
import { IWeather } from '../interfaces/weather.interface';

const weatherSchema = new Schema<IWeather>(
  {
    location: {
      type: {
        city: String,
        country: String,
      },
      required: true,
    },
    data: {
      type: {
        maxTemp: Number,
        minTemp: Number,
        humidity: Number,
        rainfall: Number,
        windSpeed: Number,
        dominantWindDirection: String,
      },
      require: true,
    },
  },
  { timestamps: true }
);

export const Weather = models.Weather || model<IWeather>('Weather', weatherSchema);
