import mongoose from 'mongoose';
import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';
import { CropDetails } from '../models/cropDetails.model';
import { CropRecommendations } from '../models/cropRecommendations.model';
import { CropSuggestionCache } from '../models/cropSuggestionCache.model';
import { CropSuggestionHistory } from '../models/cropSuggestionHistory.model';
import { CropSuggestionInput } from '../types/cropSuggestion.types';
import GeminiUtils from '../utils/gemini.utils';
import { Logger } from '../utils/logger';
import ngeohash from 'ngeohash';
import { WeatherAverages, WeatherService } from '../utils/weather.utils';

export class CropSuggestionService {
  private logger = new Logger('CropSuggestionService');
  private cropSuggestionHistoryModel = CropSuggestionHistory;
  private cropSuggestionCacheModel = CropSuggestionCache;
  private cropRecommendationsModel = CropRecommendations;
  private cropDetailsModel = CropDetails;
  private gemini = new GeminiUtils();
  public async generateCropSuggestion(
    input: CropSuggestionInput,
    userId?: string
  ): Promise<ICropRecommendations | void> {
    // const { soilType, farmSize, irrigationAvailability, location } = input;

    const cacheKey = await this.cacheKeyMaker(input);
    const existingRecommendation = await this.findSimilarityByCacheKey(cacheKey, userId);
    if (existingRecommendation) {
      this.logger.info(`Found existing crop recommendation for cache key: ${cacheKey}`);
      return existingRecommendation;
    }
    this.logger.info(`No existing crop recommendation found for cache key: ${cacheKey}`);
    const weather = new WeatherService(input.location.latitude, input.location.longitude);
    const averages = await weather.getWeatherAverages(16);
    const recommendedCrops = await this.generateRecommendedCrop({
      ...input,
      ...averages,
      userId,
      cacheKey,
    });
    console.log(recommendedCrops);
  }
  public async findSimilarityByCacheKey(
    cacheKey: string,
    userId?: string
  ): Promise<ICropRecommendations> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const historyQuery: { cacheKey: string; createdAt: { $gte: Date }; userId?: string } = {
      cacheKey,
      createdAt: { $gte: sevenDaysAgo },
    };
    if (userId) {
      historyQuery.userId = userId;
    }
    const findFromUserHistory = await this.cropSuggestionHistoryModel
      .findOne(historyQuery)
      .select('cropRecommendationsId')
      .populate({
        path: 'cropRecommendationsId',
        select: 'title description -_id',
      });

    if (!findFromUserHistory) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const cacheQuery = {
        cacheKey,
        createdAt: { $gte: oneDayAgo },
      };
      const findFromCached = await this.cropSuggestionCacheModel
        .findOne(cacheQuery)
        .select('cropRecommendationsId')
        .populate({
          path: 'cropRecommendationsId',
          select: 'title description -_id',
        });
      const cropRecommendations = findFromCached?.toObject()?.cropRecommendationsId;
      return cropRecommendations;
    }
    const cropRecommendations = findFromUserHistory?.toObject()?.cropRecommendationsId;
    return cropRecommendations;
  }

  private async cacheKeyMaker(input: CropSuggestionInput): Promise<string> {
    const { soilType, farmSize, irrigationAvailability, location } = input;
    const geoHashed = await this.locationToGeoHash(location);
    const farmSizeRange =
      farmSize <= 1
        ? 'small_0-1_acre'
        : farmSize <= 5
          ? 'medium_1-5_acres'
          : farmSize <= 10
            ? 'large_5-10_acres'
            : 'very_large_10+_acres';
    const cacheKey = `${soilType}-${farmSizeRange}-${irrigationAvailability}-${geoHashed}`;
    return cacheKey;
  }

  private async locationToGeoHash(location: CropSuggestionInput['location']): Promise<string> {
    const geohashPrecision = 5; // <--- এখানে প্রিসিশন 5 সেট করুন
    const locationGeohash = ngeohash.encode(
      location.latitude,
      location.longitude,
      geohashPrecision
    );
    return locationGeohash;
  }
  // private async transformToEmbeddingInput(input: CropSuggestionInput): Promise<string> {
  //   const { soilType, farmSize, irrigationAvailability, location } = input;
  //   const farmSizeRange =
  //     farmSize <= 1
  //       ? 'small_0-1_acre'
  //       : farmSize <= 5
  //         ? 'medium_1-5_acres'
  //         : farmSize <= 10
  //           ? 'large_5-10_acres'
  //           : 'very_large_10+_acres';
  //   const geoHashed = await this.locationToGeoHash(location);
  //   return `Soil Type: ${soilType}, Farm Size: ${farmSizeRange}, Irrigation Availability: ${irrigationAvailability}, Geographic Location: Geohash ${geoHashed}`;
  // }

  private async generateRecommendedCrop(
    input: CropSuggestionInput & WeatherAverages & { userId?: string; cacheKey?: string }
  ): Promise<any> {
    const prompt = `You are an expert agricultural assistant AI. Based on the given user input, return exactly 3 crop recommendations, minimum 3 sets of cultivation tips, and echo back the weather data exactly as provided.

  Strictly follow the JSON structure below with no extra fields, no less fields, and no explanatory text. Do not generate any sample values or deviate from the provided field names.

  ---

  ## INPUT

  - soilType: ${input.soilType}
  - farmSize: ${input.farmSize}
  - irrigationAvailability: ${input.irrigationAvailability}

  **Weather:**
  - avgMaxTemp: ${input.avgMaxTemp}
  - avgMinTemp: ${input.avgMinTemp}
  - avgHumidity: ${input.avgHumidity}
  - avgRainfall: ${input.avgRainfall}
  - avgWindSpeed: ${input.avgWindSpeed}
  - dominantWindDirection: "${input.dominantWindDirection}"

  ---

  ## OUTPUT FORMAT (strictly return valid JSON):

  {
    "crops": [
    {
      "icon": "",
      "name": "",
      "description": "",
      "match": 0
    },
    {
      "icon": "", 
      "name": "",
      "description": "",
      "match": 0
    },
    {
      "icon": "",
      "name": "",
      "description": "",
      "match": 0
    }
    ],
    "cultivationTips": [
    {
      "title": "",
      "tips": ["", "", ""]
    },
    {
      "title": "",
      "tips": ["", "", ""]
    },
    {
      "title": "",
      "tips": ["", "", ""]
    }
    ],
    "weathers":{ 
      "avgMaxTemp": ${input.avgMaxTemp},
      "avgMinTemp": ${input.avgMinTemp}, 
      "avgHumidity": ${input.avgHumidity},
      "avgRainfall": ${input.avgRainfall},
      "avgWindSpeed": ${input.avgWindSpeed},
      "dominantWindDirection": "${input.dominantWindDirection}"
    }
    
  }`;

    let tries = 0;
    const maxTries = 2;

    while (tries < maxTries) {
      try {
        const response = await this.gemini.generateResponse(prompt);
        if (!response) throw new Error('No response generated from Gemini AI');
        const parsed = JSON.parse(response);
        const dbResponse = await this.cropRecommendationsModel.create({
          ...parsed,
        });

        await this.cropSuggestionHistoryModel.create({
          userId: input.userId,
          soilType: input.soilType,
          farmSize: input.farmSize,
          irrigationAvailability: input.irrigationAvailability,
          location: input.location,
          cacheKey: input.cacheKey,
          cropRecommendationsId: dbResponse._id,
        });

        return parsed;
      } catch (error) {
        tries++;
        if (tries === maxTries) {
          throw new Error('Failed to generate valid crop recommendations after multiple attempts');
        }
        this.logger.warn('Retrying crop recommendation generation due to validation failure');
      }
    }
  }
}
