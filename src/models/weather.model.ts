import { models, Schema, model } from 'mongoose';
import { IWeather } from '../interfaces/weather.interface';

const weatherSchema = new Schema<IWeather>({
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
      date: Date,
    },
    require: true,
  },
});

export const Weather = models.Task || model<IWeather>('Weather', weatherSchema);
