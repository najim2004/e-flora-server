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
import { SocketServer } from '../socket.server';
import { CropSuggestionPrompts } from '../prompts/cropSuggestion.prompts';
import { ICropDetails } from '../interfaces/cropDetails.interface';
import mongoose, { Types } from 'mongoose';
import { CropSuggestionSocketHandler } from '../socket/cropSuggestion.socket';

export class CropSuggestionService {
  private logger: Logger;
  private cropSuggestionHistoryModel = CropSuggestionHistory;
  private cropSuggestionCacheModel = CropSuggestionCache;
  private cropRecommendationsModel = CropRecommendations;
  private cropDetailsModel = CropDetails;
  private gemini = new GeminiUtils();
  private prompts = new CropSuggestionPrompts();
  private cropSocket: CropSuggestionSocketHandler;

  constructor() {
    // Logger instance should ideally be managed as a singleton if it writes to files
    // Assuming Logger.getInstance() handles this correctly.
    this.logger = Logger.getInstance('CropSuggestionService');
    this.cropSocket = SocketServer.getInstance().getCropSuggestionSocketHandler();
  }

  /**
   * Generates crop suggestions for a user based on input parameters and weather data.
   * It first checks for existing recommendations in cache, then generates new ones using Gemini AI
   * if not found. It utilizes MongoDB transactions for atomicity of core operations.
   *
   * @param input The crop suggestion input parameters.
   * @param userId The ID of the user requesting the suggestion.
   * @returns A promise that resolves to the crop recommendations or void if an error occurs.
   */
  public async generateCropSuggestion(input: CropSuggestionInput, userId: string): Promise<void> {
    const cacheKey = this.cacheKeyMaker(input);
    this.emitProgress(userId, 'started', 10, 'Starting crop suggestion generation...');
    this.logger.info(`Initiating crop suggestion for user: ${userId}, with cacheKey: ${cacheKey}`);

    const existingRecommendation = await this.findSimilarityByCacheKey(cacheKey, userId);
    if (existingRecommendation) {
      this.logger.info(
        `Existing recommendation found for cacheKey: ${cacheKey}. Retrieving from cache.`
      );
      this.emitProgress(userId, 'completed', 100, 'Crop suggestions retrieved from cache.');
      this.cropSocket.sendFinalRecommendations(userId, existingRecommendation);
      return;
    }
    this.logger.info(
      `No existing recommendation found for cacheKey: ${cacheKey}. Generating new one.`
    );

    this.emitProgress(userId, 'processing', 20, 'Fetching weather data...');
    const weather = new WeatherService(input.location.latitude, input.location.longitude);
    const averages = await weather.getWeatherAverages(16);
    this.logger.debug(`Processed weather averages: ${JSON.stringify(averages)}`);
    this.emitProgress(userId, 'processing', 40, 'Weather data fetched. Preparing AI prompt...');

    let recommendedCrops: Pick<
      ICropRecommendations,
      '_id' | 'crops' | 'cultivationTips' | 'weathers'
    > | null = null;
    let session: mongoose.ClientSession | null = null;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      this.logger.info(`MongoDB transaction started for user: ${userId}.`);

      recommendedCrops = await this.generateAndSaveRecommendation(
        { ...input, ...averages, userId, cacheKey },
        session
      );

      // Save to cache after successful generation and history creation within the same transaction
      if (recommendedCrops && cacheKey) {
        await this.cropSuggestionCacheModel.create(
          [{ cacheKey, cropRecommendationsId: recommendedCrops._id }],
          { session }
        );
        this.logger.info(`Recommendations cached with key: ${cacheKey} within transaction.`);
        this.emitProgress(userId, 'processing', 90, 'Data saved to cache. Committing changes...');
      }

      await session.commitTransaction();
      this.logger.info(`Transaction committed successfully for user: ${userId}.`);
      this.emitProgress(userId, 'completed', 100, 'Crop suggestions generated and saved.');
    } catch (error) {
      if (session) {
        await session.abortTransaction();
        this.logger.error(
          `Transaction aborted for user: ${userId} due to error: ${(error as Error).message}`
        );
      }
      this.logger.error(
        `Failed to generate or save crop recommendations for user: ${userId}. Error: ${(error as Error).message}`
      );
      this.emitProgress(
        userId,
        'failed',
        0,
        'Failed to generate crop suggestions. Please try again.'
      );
      return;
    } finally {
      if (session) {
        session.endSession();
        this.logger.info(`MongoDB session ended for user: ${userId}.`);
      }
    }

    if (recommendedCrops) {
      this.cropSocket.sendFinalRecommendations(userId, recommendedCrops);
      // Asynchronously generate crop details.
      this.generateCropDetailsSequentially(recommendedCrops, userId);
    }

    this.logger.info(`New crop recommendations generated and sent for user: ${userId}.`);
    this.logger.debug(`Recommended crops data: ${JSON.stringify(recommendedCrops)}`);
    return;
  }

  /**
   * Searches for similar crop recommendations based on cache key, first in user's history
   * (last 7 days), then in a global cache (last 24 hours).
   *
   * @param cacheKey The unique key identifying the combination of input parameters.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the found crop recommendations or null if not found.
   */
  private async findSimilarityByCacheKey(
    cacheKey: string,
    userId: string
  ): Promise<ICropRecommendations | null> {
    this.emitProgress(userId, 'processing', 15, 'Checking user history...');
    const historyLookup = await this.findRecommendationInDB(
      this.cropSuggestionHistoryModel,
      {
        cacheKey,
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: this.getDateXDaysAgo(7) },
      },
      'user history'
    );
    if (historyLookup) return historyLookup;

    this.emitProgress(userId, 'processing', 20, 'Checking global cache...');
    const cacheLookup = await this.findRecommendationInDB(
      this.cropSuggestionCacheModel,
      { cacheKey, createdAt: { $gte: this.getDateXDaysAgo(1) } },

      'global cache'
    );
    if (cacheLookup) return cacheLookup;

    this.logger.info(
      `No existing crop recommendation found in history or cache for cacheKey: ${cacheKey}.`
    );
    return null;
  }

  /**
   * Generates and saves crop recommendations using Gemini AI, and records history.
   * This function should be called within a MongoDB transaction.
   *
   * @param input Combined input and weather data for prompt generation.
   * @param session The Mongoose client session for the transaction.
   * @returns A promise resolving to the generated crop recommendations.
   * @throws Error if Gemini AI fails to generate a valid response after multiple attempts.
   */
  private async generateAndSaveRecommendation(
    input: CropSuggestionInput & WeatherAverages & { userId?: string; cacheKey?: string },
    session: mongoose.ClientSession
  ): Promise<Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'>> {
    const {
      userId,
      cacheKey,
      soilType,
      farmSize,
      irrigationAvailability,
      location,
      ...weatherAverages
    } = input;
    const prompt = this.prompts.getCropRecommendationPrompt({
      soilType,
      farmSize,
      irrigationAvailability,
      location,
      ...weatherAverages,
    });

    const maxTries = 2;
    for (let tries = 0; tries < maxTries; tries++) {
      try {
        this.logger.info(
          `Attempt ${tries + 1} of ${maxTries} to generate recommendations for user: ${userId}.`
        );
        this.emitProgress(
          userId!,
          'processing',
          50 + tries * 10,
          `Generating recommendations (Attempt ${tries + 1})...`
        );

        const response = await this.gemini.generateResponse(prompt);
        if (!response) throw new Error('Gemini AI returned an empty response.');

        const parsed = JSON.parse(response);
        if (!parsed.crops || !Array.isArray(parsed.crops) || parsed.crops.length === 0) {
          throw new Error('Gemini AI response missing or invalid "crops" array.');
        }
        this.logger.debug(`Gemini response parsed successfully: ${JSON.stringify(parsed)}`);

        const [dbResponse] = await this.cropRecommendationsModel.create([parsed], { session });
        await this.cropSuggestionHistoryModel.create(
          [
            {
              userId: new Types.ObjectId(userId),
              soilType,
              farmSize,
              irrigationAvailability,
              location,
              cacheKey,
              cropRecommendationsId: dbResponse._id,
            },
          ],
          { session }
        );

        this.logger.info(
          `Recommendations and history saved to DB within transaction for user: ${userId}.`
        );
        this.emitProgress(
          userId!,
          'processing',
          70,
          'Recommendations generated and saved to history.'
        );
        return { ...parsed, _id: dbResponse._id };
      } catch (error) {
        this.logger.warn(
          `Failed to generate valid recommendations (Attempt ${tries + 1}). Error: ${(error as Error).message}`
        );
        if (tries === maxTries - 1) {
          this.logger.error(
            'Exceeded maximum attempts. Failed to generate valid crop recommendations.'
          );
          throw new Error('Failed to generate valid crop recommendations after multiple attempts.');
        }
      }
    }
    // Should not be reached
    throw new Error('Unexpected error in generateAndSaveRecommendation.');
  }

  /**
   * Asynchronously generates and updates detailed information for each recommended crop.
   * This process runs in the background and does not block the main recommendation flow.
   * It also checks for existing crop details to avoid redundant API calls.
   *
   * @param cropRecommendations The core crop recommendations generated.
   * @param userId The ID of the user.
   * @returns A promise that resolves when all crop details attempts are complete.
   */
  private async generateCropDetailsSequentially(
    cropRecommendations: Pick<
      ICropRecommendations,
      '_id' | 'crops' | 'cultivationTips' | 'weathers'
    >,
    userId: string
  ): Promise<void> {
    let isModified = false;
    const updatedCrops = [...cropRecommendations.crops];

    for (const crop of updatedCrops) {
      const prompt = this.prompts.getCropDetailsPrompt(crop.name, crop.scientificName);
      try {
        const existingDetails = await this.cropDetailsModel
          .findOne({ $or: [{ scientificName: crop.scientificName }, { name: crop.name }] })
          .exec();

        if (existingDetails) {
          this.logger.info(`Details exist for ${crop.name}. Skipping generation.`);
          crop.cropDetailsId = existingDetails._id;
          crop.detailsSlug = existingDetails.slug;
          isModified = true;
          this.cropSocket.emitCropDetailsUpdate(
            userId,
            existingDetails.slug,
            existingDetails.scientificName
          );
          continue;
        }

        const response = await this.gemini.generateResponse(prompt);
        if (!response) throw new Error(`Empty response for ${crop.name} details.`);

        const parsed = JSON.parse(response);
        if (!parsed.name || !parsed.scientificName)
          throw new Error(`Invalid parsed details for ${crop.name}.`);

        const detailsDbResponse = (await this.cropDetailsModel.create(parsed)) as ICropDetails & {
          _id: Types.ObjectId;
        };

        if (detailsDbResponse._id) {
          crop.cropDetailsId = detailsDbResponse._id;
          crop.detailsSlug = detailsDbResponse.slug;
          isModified = true;
          this.cropSocket.emitCropDetailsUpdate(
            userId,
            detailsDbResponse.slug,
            detailsDbResponse.scientificName
          );
          this.logger.info(`Generated and saved details for ${crop.name}.`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to generate/save details for ${crop.name}. Error: ${(error as Error).message}`
        );
        this.cropSocket.emitCropDetailsUpdate(userId, null, crop.scientificName);
      }
    }

    if (isModified) {
      try {
        await this.cropRecommendationsModel.findByIdAndUpdate(cropRecommendations._id, {
          $set: { crops: updatedCrops },
        });
        this.logger.info(
          `Recommendations updated with crop details IDs/slugs for ID: ${cropRecommendations._id}.`
        );
      } catch (error) {
        this.logger.error(
          `Failed to update recommendations with details IDs/slugs for ID: ${cropRecommendations._id}. Error: ${(error as Error).message}`
        );
        updatedCrops.map(c =>
          this.cropSocket.emitCropDetailsUpdate(userId, null, c.scientificName)
        );
      }
    } else {
      this.logger.info(
        `No new crop details generated or updated for recommendation ID: ${cropRecommendations._id}.`
      );
    }
  }

  /**
   * Creates a unique cache key based on the input parameters for efficient caching.
   *
   * @param input The crop suggestion input.
   * @returns A string representing the unique cache key.
   */
  private cacheKeyMaker(input: CropSuggestionInput): string {
    const { soilType, farmSize, irrigationAvailability, location } = input;
    const geoHashed = ngeohash.encode(location.latitude, location.longitude, 5); // Precision set to 5
    const farmSizeRange =
      farmSize <= 1
        ? 'small_0-1_acre'
        : farmSize <= 5
          ? 'medium_1-5_acres'
          : farmSize <= 10
            ? 'large_5-10_acres'
            : 'very_large_10+_acres';
    const cacheKey = `${soilType}-${farmSizeRange}-${irrigationAvailability}-${geoHashed}`;
    this.logger.debug(`Generated cacheKey: ${cacheKey}`);
    return cacheKey;
  }

  /**
   * Helper to emit progress updates via socket.
   */
  private emitProgress(
    userId: string,
    status: 'started' | 'processing' | 'completed' | 'failed',
    progress: number,
    message: string
  ): void {
    this.cropSocket.emitProgressUpdate({ userId, status, progress, message });
  }

  /**
   * Generic helper to find a recommendation in DB from either history or cache.
   */
  private async findRecommendationInDB(
    model: typeof CropSuggestionHistory | typeof CropSuggestionCache,
    query: {
      cacheKey: string;
      userId?: Types.ObjectId;
      createdAt?: { $gte: Date };
    },
    source: string
  ): Promise<ICropRecommendations | null> {
    this.logger.info(`Searching ${source} for crop suggestions.`);
    const found = await model
      .findOne(query)
      .select('cropRecommendationsId')
      .populate({
        path: 'cropRecommendationsId',
        select: 'title description crops weathers cultivationTips',
      })
      .exec();

    if (found?.cropRecommendationsId) {
      this.logger.info(`Found recommendation from ${source}.`);
      return found.cropRecommendationsId.toObject() as ICropRecommendations;
    }
    return null;
  }

  /**
   * Helper to get a date X days ago.
   */
  private getDateXDaysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
