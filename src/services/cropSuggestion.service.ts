import { ICropRecommendations } from '../interfaces/cropRecommendations.interface';
import { CropDetails } from '../models/cropDetails.model';
import { CropRecommendations } from '../models/cropRecommendations.model';
import { CropSuggestionCache } from '../models/cropSuggestionCache.model';
import { CropSuggestionHistory } from '../models/cropSuggestionHistory.model';
import { CropSuggestionInput } from '../types/cropSuggestion.types';
import GeminiUtils from '../utils/gemini.utils';
import Logger from '../utils/logger';
import ngeohash from 'ngeohash';
import { WeatherAverages, WeatherService } from '../utils/weather.utils';
import { SocketServer } from '../socket.server';
import { CropSuggestionPrompts } from '../prompts/cropSuggestion.prompts';
import { ICropDetails } from '../interfaces/cropDetails.interface';
import mongoose, { Types } from 'mongoose';
import { CropSuggestionStatus } from '../socket/cropSuggestion.socket';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';

export class CropSuggestionService {
  private logger: Logger;
  private gemini: GeminiUtils;
  private prompts: CropSuggestionPrompts;
  private socketHandler: SocketServer;

  constructor() {
    this.logger = Logger.getInstance('CropSuggestion');
    this.gemini = new GeminiUtils();
    this.prompts = new CropSuggestionPrompts();
    this.socketHandler = SocketServer.getInstance();
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
    const cacheKey = this.createCacheKey(input);
    this.emitProgress(userId, 'initiated', 10, 'Starting crop suggestion generation...');
    this.logger.info(`Initiating crop suggestion for user: ${userId}, with cacheKey: ${cacheKey}`);

    try {
      const existingRecommendation = await this.findSimilarRecommendation(cacheKey, userId);
      if (existingRecommendation) {
        this.logger.info(
          `Existing recommendation found for cacheKey: ${cacheKey}. Retrieving from cache.`
        );
        this.emitProgress(userId, 'completed', 100, 'Crop suggestions retrieved from cache.');
        // Ensure history is recorded even if from cache
        await this.recordSuggestionHistory({
          ...input,
          userId: new Types.ObjectId(userId),
          cacheKey,
          cropRecommendationsId: existingRecommendation._id,
        });
        this.socketHandler
          .cropSuggestion()
          .sendFinalRecommendations(userId, existingRecommendation);
        return;
      }

      this.logger.info(
        `No existing recommendation found for cacheKey: ${cacheKey}. Generating new one.`
      );

      const weatherAverages = await this.fetchWeatherData(input, userId);
      const recommendedCrops = await this.processNewRecommendation(
        input,
        userId,
        cacheKey,
        weatherAverages
      );

      if (recommendedCrops) {
        this.socketHandler.cropSuggestion().sendFinalRecommendations(userId, recommendedCrops);
        this.generateCropDetailsInBackground(recommendedCrops, userId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate crop recommendations for user: ${userId}. Error: ${(error as Error).message}`
      );
      this.emitProgress(
        userId,
        'failed',
        0,
        'Failed to generate crop suggestions. Please try again.'
      );
    }
  }

  /**
   * Searches for similar crop recommendations based on cache key, first in user's history
   * (last 7 days), then in a global cache (last 24 hours).
   *
   * @param cacheKey The unique key identifying the combination of input parameters.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the found crop recommendations or null if not found.
   */
  private async findSimilarRecommendation(
    cacheKey: string,
    userId: string
  ): Promise<ICropRecommendations | null> {
    this.emitProgress(userId, 'initiated', 15, 'Checking user history...');
    const historyLookup = await this.getRecommendationFromModel(
      CropSuggestionHistory,
      {
        cacheKey,
        userId: new Types.ObjectId(userId),
        createdAt: { $gte: this.getDateXDaysAgo(7) },
      },
      'user history'
    );
    if (historyLookup) return historyLookup;

    this.emitProgress(userId, 'initiated', 20, 'Checking global cache...');
    const cacheLookup = await this.getRecommendationFromModel(
      CropSuggestionCache,
      { cacheKey, createdAt: { $gte: this.getDateXDaysAgo(1) } },
      'global cache'
    );
    return cacheLookup;
  }

  /**
   * Fetches weather data for the given location.
   */
  private async fetchWeatherData(
    input: CropSuggestionInput,
    userId: string
  ): Promise<WeatherAverages> {
    this.emitProgress(userId, 'analyzing', 20, 'Fetching weather data...');
    const weather = new WeatherService(input.location.latitude, input.location.longitude);
    const averages = await weather.getWeatherAverages(16);
    this.logger.debug(`Processed weather averages: ${JSON.stringify(averages)}`);
    this.emitProgress(userId, 'analyzing', 40, 'Weather data fetched. Preparing AI prompt...');
    return averages;
  }

  /**
   * Processes new recommendation generation, including AI interaction, saving to DB, and caching.
   * This function operates within a MongoDB transaction.
   */
  private async processNewRecommendation(
    input: CropSuggestionInput,
    userId: string,
    cacheKey: string,
    weatherAverages: WeatherAverages
  ): Promise<Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'> | null> {
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      this.logger.info(`MongoDB transaction started for user: ${userId}.`);

      const recommendedCrops = await this.generateRecommendationWithGemini(
        input,
        userId,
        weatherAverages
      );

      if (recommendedCrops) {
        // Save to cache
        await CropSuggestionCache.create(
          [{ cacheKey, cropRecommendationsId: recommendedCrops._id }],
          { session }
        );
        this.logger.info(`Recommendations cached with key: ${cacheKey} within transaction.`);
        this.emitProgress(userId, 'savingToDB', 90, 'Data saved to cache. Committing changes...');

        // Record history
        await this.recordSuggestionHistory(
          {
            ...input,
            userId: new Types.ObjectId(userId),
            cacheKey,
            cropRecommendationsId: recommendedCrops._id,
          },
          session
        );

        await session.commitTransaction();
        this.logger.info(`Transaction committed successfully for user: ${userId}.`);
        this.emitProgress(userId, 'completed', 100, 'Crop suggestions generated and saved.');
        this.logger.debug(`Recommended crops data: ${JSON.stringify(recommendedCrops)}`);
        return recommendedCrops;
      }
      return null;
    } catch (error) {
      if (session) {
        await session.abortTransaction();
        this.logger.error(
          `Transaction aborted for user: ${userId} due to error: ${(error as Error).message}`
        );
      }
      throw error; // Re-throw to be caught by generateCropSuggestion's catch block
    } finally {
      if (session) {
        session.endSession();
        this.logger.info(`MongoDB session ended for user: ${userId}.`);
      }
    }
  }

  /**
   * Generates crop recommendations using Gemini AI and saves them to the database.
   * This function should be called within a MongoDB transaction.
   */
  private async generateRecommendationWithGemini(
    input: CropSuggestionInput,
    userId: string,
    weatherAverages: WeatherAverages
  ): Promise<Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'>> {
    const prompt = this.prompts.getCropRecommendationPrompt({ ...input, ...weatherAverages });
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.emitProgress(
          userId,
          'generatingData',
          50 + (attempt - 1) * 10,
          `Generating recommendations (Attempt ${attempt})...`
        );
        const response = await this.gemini.generateResponse(prompt);
        if (!response) throw new Error('Gemini AI returned an empty response.');

        const parsed = JSON.parse(response);
        if (!parsed.crops || !Array.isArray(parsed.crops) || parsed.crops.length === 0) {
          throw new Error('Gemini AI response missing or invalid "crops" array.');
        }
        this.logger.debug(`Gemini response parsed successfully: ${JSON.stringify(parsed)}`);

        const [dbResponse] = await CropRecommendations.create([parsed]); // Mongoose handles session implicitly if passed in main create
        this.logger.info(`Recommendations saved to DB for user: ${userId}.`);
        return { ...parsed, _id: dbResponse._id };
      } catch (error) {
        this.logger.warn(
          `Failed to generate valid recommendations (Attempt ${attempt}). Error: ${(error as Error).message}`
        );
        if (attempt === maxRetries) {
          throw new Error('Failed to generate valid crop recommendations after multiple attempts.');
        }
      }
    }
    throw new Error('Unexpected error in generateRecommendationWithGemini.'); // Should not be reached
  }

  /**
   * Records the crop suggestion request in the user's history.
   */
  private async recordSuggestionHistory(
    input: Omit<ICropSuggestionHistory, 'createdAt' | 'updatedAt' | '_id'>,
    session?: mongoose.ClientSession
  ): Promise<ICropSuggestionHistory> {
    const newHistory = await CropSuggestionHistory.create(
      [
        {
          userId: input.userId,
          soilType: input.soilType,
          farmSize: input.farmSize,
          irrigationAvailability: input.irrigationAvailability,
          location: input.location,
          cacheKey: input.cacheKey,
          cropRecommendationsId: input.cropRecommendationsId,
        },
      ],
      { session }
    );
    this.logger.info(`Crop suggestion history recorded for user: ${input.userId.toString()}.`);
    if (!newHistory || newHistory.length == 0) throw new Error('Failed to save history');
    return newHistory[0];
  }

  /**
   * Asynchronously generates and updates detailed information for each recommended crop.
   * This process runs in the background and does not block the main recommendation flow.
   */
  private async generateCropDetailsInBackground(
    { _id, crops }: Pick<ICropRecommendations, '_id' | 'crops'>,
    userId: string
  ): Promise<void> {
    const updatedCrops = await Promise.all(
      crops.map(async crop => {
        try {
          const existing = (await CropDetails.findOne({
            $or: [{ scientificName: crop.scientificName }, { name: crop.name }],
          })
            .select('_id slug scientificName')
            .exec()) as Pick<ICropDetails, '_id' | 'slug' | 'scientificName'>;

          if (existing) {
            this.logger.info(`Details exist for ${crop.name}. Skipping generation.`);
            this.socketHandler
              .cropSuggestion()
              .emitCropDetailsUpdate(userId, existing.slug, existing.scientificName);
            return {
              ...crop,
              cropDetails: { status: 'success', id: existing._id, slug: existing.slug },
            };
          }

          const response = await this.gemini.generateResponse(
            this.prompts.getCropDetailsPrompt(crop.name, crop.scientificName)
          );
          if (!response) throw new Error('Empty response');

          const parsed = JSON.parse(response);
          if (!parsed.name || !parsed.scientificName) throw new Error('Invalid parsed details');

          const saved = (await CropDetails.create(parsed)) as ICropDetails;

          this.socketHandler
            .cropSuggestion()
            .emitCropDetailsUpdate(userId, saved.slug, saved.scientificName);
          this.logger.info(`Generated and saved details for ${crop.name}.`);

          return { ...crop, cropDetails: { status: 'success', id: saved._id, slug: saved.slug } };
        } catch (err) {
          this.logger.warn(`Failed for ${crop.name}: ${(err as Error).message}`);
          this.socketHandler
            .cropSuggestion()
            .emitCropDetailsUpdate(userId, null, crop.scientificName);
          return { ...crop, cropDetails: { status: 'failed' } };
        }
      })
    );

    try {
      await CropRecommendations.findByIdAndUpdate(_id, { $set: { crops: updatedCrops } });
      this.logger.info(`Recommendations updated for ID: ${_id}.`);
    } catch (err) {
      this.logger.error(
        `Failed to update recommendations for ID: ${_id}. Error: ${(err as Error).message}`
      );
      updatedCrops.forEach(c =>
        this.socketHandler.cropSuggestion().emitCropDetailsUpdate(userId, null, c.scientificName)
      );
    }
  }

  /**
   * Creates a unique cache key based on the input parameters for efficient caching.
   *
   * @param input The crop suggestion input.
   * @returns A string representing the unique cache key.
   */
  private createCacheKey(input: CropSuggestionInput): string {
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
    status: CropSuggestionStatus,
    progress: number,
    message: string
  ): void {
    this.socketHandler.cropSuggestion().emitProgressUpdate({ userId, status, progress, message });
  }

  /**
   * Generic helper to find a recommendation in DB from either history or cache.
   */
  private async getRecommendationFromModel(
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
        select: 'crops weathers cultivationTips',
      })
      .exec();

    if (found?.cropRecommendationsId) {
      this.logger.info(`Found recommendation from ${source}.`);
      const { cropRecommendationsId } = found;
      return {
        _id: cropRecommendationsId._id,
        crops: found.cropRecommendationsId.crops,
        cultivationTips: found.cropRecommendationsId.cultivationTips,
        weathers: found.cropRecommendationsId.weathers,
      } as ICropRecommendations;
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
