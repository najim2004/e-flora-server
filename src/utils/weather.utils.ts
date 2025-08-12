import axios from 'axios';
import { BadRequestError } from './errors';

interface DailyWeatherData {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  wind_direction_10m_dominant: number[];
  relative_humidity_2m_mean: number[];
}

export interface WeatherAverages {
  avgMaxTemp: number;
  avgMinTemp: number;
  avgHumidity: number;
  avgRainfall: number;
  avgWindSpeed: number;
  dominantWindDirection: number;
}

export class WeatherService {
  private readonly BASE_URL = 'https://api.open-meteo.com/v1/forecast';

  constructor(
    private latitude: number,
    private longitude: number
  ) {}

  private average(arr: number[]): number {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  // Wind direction average handled differently
  private averageWindDirection(directions: number[]): number {
    const radians = directions.map(deg => (deg * Math.PI) / 180);
    const x = radians.reduce((sum, r) => sum + Math.cos(r), 0);
    const y = radians.reduce((sum, r) => sum + Math.sin(r), 0);
    return (Math.atan2(y, x) * 180) / Math.PI + (360 % 360);
  }

  async getWeatherAverages(days = 7): Promise<WeatherAverages> {
    if (days > 16) throw new BadRequestError('Forecast data is only available for up to 16 days');
    const url = `${this.BASE_URL}?latitude=${this.latitude}&longitude=${this.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,relative_humidity_2m_mean&timezone=auto&forecast_days=${days}`;

    const response = await axios.get(url, { family: 4 });
    const data: DailyWeatherData = response.data.daily;

    return {
      avgMaxTemp: Number(this.average(data.temperature_2m_max.slice(0, days)).toFixed(2)),
      avgMinTemp: Number(this.average(data.temperature_2m_min.slice(0, days)).toFixed(2)),
      avgHumidity: Number(this.average(data.relative_humidity_2m_mean.slice(0, days)).toFixed(2)),
      avgRainfall: Number(this.average(data.precipitation_sum.slice(0, days)).toFixed(2)),
      avgWindSpeed: Number(this.average(data.wind_speed_10m_max.slice(0, days)).toFixed(2)),
      dominantWindDirection: Number(
        this.averageWindDirection(data.wind_direction_10m_dominant.slice(0, days)).toFixed(2)
      ),
    };
  }
}
