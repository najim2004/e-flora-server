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

export class CropSuggestionService {
  private logger = new Logger('CropSuggestionService');
  private cropSuggestionHistoryModel = CropSuggestionHistory;
  private cropSuggestionCacheModel = CropSuggestionCache;
  private cropRecommendationsModel = CropRecommendations;
  private cropDetailsModel = CropDetails;
  private gemini = new GeminiUtils();
  private cropSocket = SocketServer.getInstance().getCropSuggestionSocketHandler();
  private prompts = new CropSuggestionPrompts();

  /**
   * Generates crop suggestions for a user based on input parameters and weather data.
   * It first checks for existing recommendations in cache, then generates new ones using Gemini AI
   * if not found. It utilizes MongoDB transactions for atomicity of core operations.
   *
   * @param input The crop suggestion input parameters.
   * @param userId The ID of the user requesting the suggestion.
   * @returns A promise that resolves to the crop recommendations or void if an error occurs.
   */
  public async generateCropSuggestion(
    input: CropSuggestionInput,
    userId: string
  ): Promise<Pick<ICropRecommendations, '_id' | 'crops' | 'cultivationTips' | 'weathers'> | void> {
    const cacheKey = this.cacheKeyMaker(input);
    this.cropSocket.emitProgressUpdate({
      userId: userId,
      status: 'started',
      progress: 10,
      message: 'Starting crop suggestion generation...',
    });
    this.logger.info(`Initiating crop suggestion for user: ${userId}, with cacheKey: ${cacheKey}`);

    const existingRecommendation = await this.findSimilarityByCacheKey(cacheKey, userId);
    if (existingRecommendation) {
      this.logger.info(
        `Existing crop recommendation found for cacheKey: ${cacheKey}. Retrieving from cache.`
      );
      this.cropSocket.emitProgressUpdate({
        userId: userId,
        status: 'completed',
        progress: 100,
        message: 'Crop suggestions retrieved from cache.',
      });
      this.cropSocket.sendFinalRecommendations(userId, existingRecommendation);
      return existingRecommendation;
    }
    this.logger.info(
      `No existing crop recommendation found for cacheKey: ${cacheKey}. Generating new one.`
    );

    this.cropSocket.emitProgressUpdate({
      userId: userId,
      status: 'processing',
      progress: 20,
      message: 'Fetching weather data...',
    });

    const weather = new WeatherService(input.location.latitude, input.location.longitude);
    const averages = await weather.getWeatherAverages(16);
    this.logger.debug(`Workspaceed weather averages: ${JSON.stringify(averages)}`);
    this.cropSocket.emitProgressUpdate({
      userId: userId,
      status: 'processing',
      progress: 40,
      message: 'Weather data fetched. Preparing AI prompt...',
    });

    let recommendedCrops: Pick<
      ICropRecommendations,
      '_id' | 'crops' | 'cultivationTips' | 'weathers'
    > | null = null;
    let session: mongoose.ClientSession | null = null;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      this.logger.info(`MongoDB transaction started for user: ${userId}.`);

      recommendedCrops = await this.generateRecommendedCrop(
        {
          ...input,
          ...averages,
          userId,
          cacheKey,
        },
        session
      );
      this.cropSocket.emitProgressUpdate({
        userId: userId,
        status: 'processing',
        progress: 80,
        message: 'Crop recommendations generated. Saving to database and cache...',
      });

      // Save to cache after successful generation and history creation within the same transaction
      if (recommendedCrops && cacheKey) {
        await this.cropSuggestionCacheModel.create(
          [
            {
              cacheKey,
              cropRecommendationsId: recommendedCrops._id,
            },
          ],
          { session }
        );
        this.logger.info(`Crop recommendations cached with key: ${cacheKey} within transaction.`);
        this.cropSocket.emitProgressUpdate({
          userId: userId,
          status: 'processing',
          progress: 90,
          message: 'Data saved to cache. Committing changes...',
        });
      }

      await session.commitTransaction();
      this.logger.info(`Transaction committed successfully for user: ${userId}.`);
      this.cropSocket.emitProgressUpdate({
        userId: userId,
        status: 'completed',
        progress: 100,
        message: 'Crop suggestions generated and saved.',
      });
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
      this.cropSocket.emitProgressUpdate({
        userId: userId,
        status: 'failed',
        progress: 0,
        message: 'Failed to generate crop suggestions. Please try again.',
      });
      return;
    } finally {
      if (session) {
        session.endSession();
        this.logger.info(`MongoDB session ended for user: ${userId}.`);
      }
    }

    if (recommendedCrops) {
      this.cropSocket.sendFinalRecommendations(userId, recommendedCrops);
      // Asynchronously generate crop details. This operation is independent and does not require a transaction
      // as its failure should not roll back the main recommendation.
      this.generateCropDetailsSequentially(recommendedCrops, userId);
    }

    this.logger.info(`New crop recommendations generated and sent for user: ${userId}.`);
    this.logger.debug(`Recommended crops data: ${JSON.stringify(recommendedCrops)}`);
    return recommendedCrops;
  }

  /**
   * Searches for similar crop recommendations based on cache key, first in user's history
   * (last 7 days), then in a global cache (last 24 hours).
   *
   * @param cacheKey The unique key identifying the combination of input parameters.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the found crop recommendations or null if not found.
   */
  public async findSimilarityByCacheKey(
    cacheKey: string,
    userId: string
  ): Promise<ICropRecommendations | null> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const historyQuery = {
      cacheKey,
      userId: new Types.ObjectId(userId), // Ensure userId is an ObjectId for accurate comparison
      createdAt: { $gte: sevenDaysAgo },
    };

    this.logger.info(
      `Searching user history for crop suggestions with cacheKey: ${cacheKey} and userId: ${userId}`
    );

    // Using .exec() to return a full Mongoose document, avoiding .lean()
    const findFromUserHistory = await this.cropSuggestionHistoryModel
      .findOne(historyQuery)
      .select('cropRecommendationsId')
      .populate({
        path: 'cropRecommendationsId',
        select: 'title description crops weathers cultivationTips', // Select all necessary fields for a complete recommendation
      })
      .exec(); // Execute the query

    if (findFromUserHistory?.cropRecommendationsId) {
      this.logger.info(`Found crop recommendation from user history for cacheKey: ${cacheKey}.`);
      this.cropSocket.emitProgressUpdate({
        userId: userId,
        status: 'processing',
        progress: 15,
        message: 'Retrieving from user history...',
      });
      // Convert to plain object to ensure it matches the return type if needed, without .lean()
      return findFromUserHistory.cropRecommendationsId.toObject() as ICropRecommendations;
    }

    this.logger.info(`No history found. Checking global cache for cacheKey: ${cacheKey}.`);
    this.cropSocket.emitProgressUpdate({
      userId: userId,
      status: 'processing',
      progress: 20,
      message: 'Checking global cache...',
    });

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const cacheQuery = {
      cacheKey,
      createdAt: { $gte: oneDayAgo },
    };

    // Using .exec() to return a full Mongoose document, avoiding .lean()
    const findFromCached = await this.cropSuggestionCacheModel
      .findOne(cacheQuery)
      .select('cropRecommendationsId')
      .populate({
        path: 'cropRecommendationsId',
        select: 'title description crops weathers cultivationTips', // Select all necessary fields for a complete recommendation
      })
      .exec(); // Execute the query

    if (findFromCached?.cropRecommendationsId) {
      this.logger.info(`Found cached crop recommendation for cacheKey: ${cacheKey}.`);
      // Convert to plain object to ensure it matches the return type if needed, without .lean()
      return findFromCached.cropRecommendationsId.toObject() as ICropRecommendations;
    }

    this.logger.info(
      `No existing crop recommendation found in history or cache for cacheKey: ${cacheKey}.`
    );
    return null;
  }

  /**
   * Creates a unique cache key based on the input parameters for efficient caching.
   *
   * @param input The crop suggestion input.
   * @returns A string representing the unique cache key.
   */
  private cacheKeyMaker(input: CropSuggestionInput): string {
    const { soilType, farmSize, irrigationAvailability, location } = input;
    const geoHashed = this.locationToGeoHash(location);
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
   * Converts a latitude and longitude into a geohash for location-based grouping.
   *
   * @param location The location object with latitude and longitude.
   * @returns The generated geohash string.
   */
  private locationToGeoHash(location: CropSuggestionInput['location']): string {
    const geohashPrecision = 5; // Precision set to 5 for location grouping
    const locationGeohash = ngeohash.encode(
      location.latitude,
      location.longitude,
      geohashPrecision
    );
    this.logger.debug(
      `Generated geohash: ${locationGeohash} for location: ${JSON.stringify(location)}`
    );
    return locationGeohash;
  }

  /**
   * Generates crop recommendations using Gemini AI. Includes retry logic for robustness.
   * This function should be called within a MongoDB transaction.
   *
   * @param input Combined input and weather data for prompt generation.
   * @param session The Mongoose client session for the transaction.
   * @returns A promise resolving to the generated crop recommendations.
   * @throws Error if Gemini AI fails to generate a valid response after multiple attempts.
   */
  private async generateRecommendedCrop(
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

    let tries = 0;
    const maxTries = 2;

    while (tries < maxTries) {
      try {
        this.logger.info(
          `Attempt ${tries + 1} of ${maxTries} to generate crop recommendations for user: ${userId}.`
        );
        this.cropSocket.emitProgressUpdate({
          userId: userId!,
          status: 'processing',
          progress: 50 + tries * 10, // Adjust progress dynamically
          message: `Generating recommendations (Attempt ${tries + 1})...`,
        });

        const response = await this.gemini.generateResponse(prompt);
        if (!response) {
          throw new Error('Gemini AI returned an empty response.');
        }

        const parsed = JSON.parse(response);
        // Basic validation for the parsed response structure
        if (!parsed.crops || !Array.isArray(parsed.crops) || parsed.crops.length === 0) {
          throw new Error('Gemini AI response missing or invalid "crops" array.');
        }
        this.logger.debug(`Gemini response parsed successfully: ${JSON.stringify(parsed)}`);

        // Create the crop recommendation document within the transaction
        const dbResponse = (
          await this.cropRecommendationsModel.create([parsed], { session })
        )[0] as ICropRecommendations;

        // Create the history entry within the same transaction
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
          `Crop recommendations and history saved to DB within transaction for user: ${userId}.`
        );
        this.cropSocket.emitProgressUpdate({
          userId: userId!,
          status: 'processing',
          progress: 70,
          message: 'Recommendations generated and saved to history.',
        });

        return { ...parsed, _id: dbResponse._id };
      } catch (error) {
        tries++;
        this.logger.warn(
          `Failed to generate valid crop recommendations (Attempt ${tries}). Error: ${(error as Error).message}`
        );
        if (tries === maxTries) {
          this.logger.error(
            'Exceeded maximum attempts. Failed to generate valid crop recommendations.'
          );
          throw new Error('Failed to generate valid crop recommendations after multiple attempts.');
        }
      }
    }
    // This line should ideally not be reached if maxTries logic is sound
    throw new Error(
      'Unexpected error: generateRecommendedCrop completed without a response after all attempts.'
    );
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
  public async generateCropDetailsSequentially(
    cropRecommendations: Pick<
      ICropRecommendations,
      '_id' | 'crops' | 'cultivationTips' | 'weathers'
    >,
    userId: string
  ): Promise<void> {
    let isModified = false;
    const updatedCrops = [...cropRecommendations.crops]; // Create a mutable copy

    // Using a for...of loop for cleaner iteration over the array
    for (const crop of updatedCrops) {
      // Directly iterate over `updatedCrops`
      const prompt = this.prompts.getCropDetailsPrompt(crop.name, crop.scientificName);

      try {
        // Check if details already exist for this crop (by scientificName or name)
        const existingDetails = await this.cropDetailsModel
          .findOne({
            $or: [{ scientificName: crop.scientificName }, { name: crop.name }],
          })
          .exec(); // Using .exec() to return a full Mongoose document

        if (existingDetails) {
          this.logger.info(
            `Crop details already exist for ${crop.name} (${crop.scientificName}). Skipping generation.`
          );
          // Directly update the properties of the `crop` object from `updatedCrops`
          crop.cropDetailsId = existingDetails._id;
          crop.detailsSlug = existingDetails.slug;
          isModified = true;
          this.cropSocket.emitCropDetailsUpdate(
            userId,
            existingDetails.slug,
            existingDetails.scientificName
          );
          continue; // Move to the next crop in the loop
        }

        // If not existing, generate new details using Gemini AI
        const response = await this.gemini.generateResponse(prompt);
        if (!response) {
          throw new Error(`Gemini AI returned an empty response for ${crop.name} details.`);
        }

        const parsed = JSON.parse(response);
        // Basic validation for parsed details to ensure essential fields are present
        if (!parsed.name || !parsed.scientificName) {
          throw new Error(`Invalid or incomplete parsed details for ${crop.name}.`);
        }

        const detailsDbResponse = (await this.cropDetailsModel.create(parsed)) as ICropDetails & {
          _id: Types.ObjectId;
        };

        if (detailsDbResponse._id) {
          // Update the `crop` object with the newly created details' ID and slug
          crop.cropDetailsId = detailsDbResponse._id;
          crop.detailsSlug = detailsDbResponse.slug; // Assuming slug is generated by the model
          isModified = true;
          this.cropSocket.emitCropDetailsUpdate(
            userId,
            detailsDbResponse.slug,
            detailsDbResponse.scientificName
          );
          this.logger.info(
            `Generated and saved details for ${crop.name} (${crop.scientificName}).`
          );
        }
      } catch (error) {
        // Log the warning and emit a null slug to indicate failure for this specific crop
        this.logger.warn(
          `Failed to generate or save details for ${crop.name} (${crop.scientificName}). Error: ${(error as Error).message}`
        );
        this.cropSocket.emitCropDetailsUpdate(userId, null, crop.scientificName);
      }
    }

    // Only attempt to update the main cropRecommendations document if any modifications were made
    if (isModified) {
      try {
        // Update the main crop recommendations document with the newly added details IDs and slugs
        await this.cropRecommendationsModel.findByIdAndUpdate(cropRecommendations._id, {
          $set: { crops: updatedCrops }, // Save the `updatedCrops` array back to the document
        });
        this.logger.info(
          `Crop recommendations updated with crop details IDs/slugs for ID: ${cropRecommendations._id}.`
        );
      } catch (error) {
        // Log the error if the update to the main recommendations document fails
        this.logger.error(
          `Failed to update crop recommendations with details IDs/slugs for ID: ${cropRecommendations._id}. Error: ${(error as Error).message}`
        );
        // If the batch update fails, ensure individual failures are still communicated via sockets
        updatedCrops.map(c =>
          this.cropSocket.emitCropDetailsUpdate(userId, c.detailsSlug || null, c.scientificName)
        );
      }
    } else {
      this.logger.info(
        `No new crop details generated or updated for recommendation ID: ${cropRecommendations._id}.`
      );
    }
  }
}
