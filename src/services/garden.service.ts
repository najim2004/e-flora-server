import { Types } from 'mongoose';
import { ICrop } from '../interfaces/crop.interface';
import { IPlantingGuide } from '../interfaces/plantingGuide.interface';
import { Crop } from '../models/crop.model';
import { PlantingGuideModel } from '../models/plantingGuide.model';
import { SocketServer } from '../socket.server';
import GeminiUtils from '../utils/gemini.utils';
import Logger from '../utils/logger';
import { GardenCrop } from '../models/gardenCrop.model';
import { GardenPrompts } from '../prompts/garden.prompts';
import { BadRequestError } from '../utils/errors';
import { IGarden } from '../interfaces/garden.interface';
import { Garden } from '../models/garden.model';
import { IGardenCrop } from '../interfaces/gardenCrop.interface';
import { IImage } from '../interfaces/image.interface';
import { Weather } from '../models/weather.model';
import { WeatherService, } from '../utils/weather.utils';
import { IWeather } from '../interfaces/weather.interface';

type CropPreview = Pick<ICrop, '_id' | 'name' | 'scientificName' | 'description' | 'image'>;

export class GardenService {
  private log: Logger;
  private readonly gemini = new GeminiUtils();
  private socket: SocketServer;

  constructor() {
    this.log = Logger.getInstance('GardenService');
    this.socket = SocketServer.getInstance();
  }

  /**
   * Public entry: validate crop and trigger async background process
   */
  public async addPlantToGarden({
    gardenId,
    uId,
    cropId,
  }: {
    gardenId: string;
    uId: string;
    cropId: string;
  }): Promise<string> {
    const [userId, gId] = [uId, gardenId].map(id => new Types.ObjectId(id));
    const crop = await this.findCrop(cropId);
    if (!crop) throw new BadRequestError('Crop not found!');

    void this.handleBackgroundAdd(crop, userId, gId); // async fire & forget
    return `Crop "${crop.name}" is being added to your garden. Planting guide will be generated soon.`;
  }

  /**
   * Background async job for guide generation + DB insert
   */
  private async handleBackgroundAdd(
    crop: CropPreview,
    userId: Types.ObjectId,
    gId: Types.ObjectId
  ): Promise<void> {
    this.log.info('Background add started', { cropId: crop._id, userId: userId.toString() });

    try {
      const guideId = await this.generateGuide(crop, gId);

      let finalCropName = crop.name;
      const existingCrops = await GardenCrop.find({
        userId,
        cropName: { $regex: `^${crop.name}(\s\d+)?$`, $options: 'i' },
      });

      if (existingCrops.length > 0) {
        let maxNum = 1;
        for (const existingCrop of existingCrops) {
          const match = existingCrop.cropName.match(/\s(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= maxNum) {
              maxNum = num + 1;
            }
          }
        }
        finalCropName = `${crop.name} ${maxNum === 1 ? 2 : maxNum}`; // Start with 2 if only base name exists
      }

      const newGardenCrop = await GardenCrop.create({
        userId,
        garden: gId,
        cropId: crop._id,
        cropName: finalCropName,
        scientificName: crop.scientificName,
        plantingGuide: guideId,
        image: crop.image,
        description: crop.description,
      });

      // Update the Garden document to include the new crop's ID
      await Garden.findByIdAndUpdate(gId, { $push: { crops: newGardenCrop._id } });

      this.log.info(`Garden ${gId} updated with new crop ${newGardenCrop._id}.`);
      const updatedGarden = await Garden.findById(gId);
      this.log.info(`Garden crops array after update: ${updatedGarden?.crops}`);

      this.emitGardenStatus(userId.toString(), {
        success: true,
        message: `${crop.name} successfully added.`,
        cropId: crop._id.toString(),
      });
      this.log.info('Background add success', {
        cropId: crop._id,
        guideId,
        userId: userId.toString(),
      });
    } catch (error) {
      this.emitGardenStatus(userId.toString(), {
        success: false,
        message: `${crop.name} failed to add.`,
        cropId: crop._id.toString(),
      });
      this.log.logError(error as Error, 'handleBackgroundAdd');
    }
  }

  /**
   * Crop fetch helper
   */
  private async findCrop(cropId: string): Promise<CropPreview | null> {
    return Crop.findById(cropId)
      .select('_id name scientificName image description')
      .lean() as Promise<CropPreview | null>;
  }

  /**
   * Generate planting guide using Gemini
   */
  private async generateGuide(
    crop: CropPreview,
    gardenId: Types.ObjectId
  ): Promise<Types.ObjectId> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const prompt = new GardenPrompts().plantingGuideGeneratingPrompt(
          crop.name,
          crop.scientificName,
          crop.description
        );
        const raw = await this.gemini.generateResponse(prompt);
        const parsed = this.parseJSON<IPlantingGuide>(raw, 'planting guide');

        if (parsed) {
          const res = await PlantingGuideModel.create({
            plantingSteps: parsed,
            gardenId,
            cropId: crop._id,
          });
          return res._id;
        }
      } catch (e) {
        this.log.warn('Retry guide generation', {
          attempt,
          cropName: crop.name,
          error: (e as Error).message,
        });
      }
    }
    throw new Error('[generateGuide]: Failed to generate planting guide');
  }

  /**
   * JSON parser utility
   */
  private parseJSON<T>(raw: unknown, label: string): T | null {
    if (typeof raw !== 'string') return raw as T;
    try {
      const clean = raw
        .replace(/^```json?\n?/, '')
        .replace(/```$/, '')
        .trim();
      return JSON.parse(clean) as T;
    } catch (e) {
      this.log.warn(`${label} JSON parse failed`, { error: (e as Error).message });
      return null;
    }
  }

  /**
   * Emit garden status event to user
   */
  private emitGardenStatus(
    userId: string,
    data: { success: boolean; message: string; cropId: string }
  ): void {
    this.socket.cropSuggestion().emitGardenAddingStatus(userId, data);
  }

  private async _getOrCreateDailyWeather(
    city: string,
    country: string,
    state?: string
  ): Promise<IWeather | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    try {
      // Try to find cached weather data for today
      const cachedWeather = await Weather.findOne({
        'location.city': city,
        'location.country': country,
        createdAt: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      });

      if (cachedWeather) {
        this.log.info(`Cached weather found for ${city}, ${country}`);
        return cachedWeather;
      }

      // If not cached, fetch coordinates first
      this.log.info(`Attempting to fetch coordinates for ${city}, ${country}${state ? ', ' + state : ''}`);
      const geoService = new WeatherService(); // Instantiate without lat/lon
      const coordinates = await geoService.getCoordinates(city, country, state);

      if (!coordinates) {
        this.log.warn(`Failed to get coordinates for ${city}, ${country}${state ? ', ' + state : ''}`);
        return null;
      }
      this.log.info(`Coordinates obtained: Lat ${coordinates.latitude}, Lon ${coordinates.longitude}`);

      // Then fetch new weather data for today using obtained coordinates
      this.log.info(`Attempting to fetch weather for ${city}, ${country} using coordinates`);
      const weatherService = new WeatherService(coordinates.latitude, coordinates.longitude);
      const weather = await weatherService.getCurrentWeather(); // Fetch only for today

      if (!weather) {
        this.log.warn(`Weather data unavailable for ${city}, ${country}${state ? ', ' + state : ''}`);
        return null;
      }

      // Save the new weather data to the database
      this.log.info(`Saving new weather data for ${city}, ${country}`);
      const newWeather = await Weather.create({
        location: {
          city,
          country,
        },
        data: {
          ...weather,
        },
      });

      return newWeather;
    } catch (error) {
      this.log.error(`Error in _getOrCreateDailyWeather for ${city}, ${country}: ${(error as Error).message}`);
      return null;
    }
  }

  public async getMyGarden({ uId, gardenId }: { uId: string; gardenId: string }): Promise<
    | (Omit<IGarden, 'crops' | 'tasks' | 'createdAt' | 'updatedAt'> & {
        weather: IWeather['data'];
        crops: (Pick<
          IGardenCrop,
          '_id' | 'cropName' | 'scientificName' | 'healthScore' | 'status'
        > & {
          image: Pick<IImage, '_id' | 'url' | 'index'>;
          nextTask: string;
        })[];
        removedCrops: (Pick<
          IGardenCrop,
          '_id' | 'cropName' | 'scientificName' | 'healthScore' | 'status'
        > & { image: Pick<IImage, '_id' | 'url' | 'index'> })[];
      })
    | null
  > {
    const [userId, gId] = [uId, gardenId].map(id => new Types.ObjectId(id));

    const garden = await Garden.aggregate([
      { $match: { _id: gId, userId } },
      {
        $lookup: {
          from: 'gardencrops',
          localField: 'crops',
          foreignField: '_id',
          as: 'crops',
          pipeline: [
            {
              $project: {
                _id: 1,
                cropName: 1,
                scientificName: 1,
                healthScore: 1,
                status: 1,
                image: 1,
                currentStage: 1,
                plantedDate: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
            {
              $lookup: {
                from: 'images',
                localField: 'image',
                foreignField: '_id',
                as: 'image',
                pipeline: [{ $project: { _id: 1, url: 1, index: 1 } }],
              },
            },
            { $addFields: { image: { $arrayElemAt: ['$image', 0] } } },
            {
              $lookup: {
                from: 'tasks',
                let: { cropId: '$_id' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$cropId', '$$cropId'] } } },
                  { $match: { status: 'pending', dueDate: { $gte: new Date() } } },
                  { $sort: { dueDate: 1 } },
                  { $limit: 1 },
                  { $project: { taskName: 1, _id: 0 } },
                ],
                as: 'nextTask',
              },
            },
            { $addFields: { nextTask: { $arrayElemAt: ['$nextTask.taskName', 0] } } },
          ],
        },
      },
      {
        $addFields: {
          archivedCrops: {
            $filter: {
              input: '$crops',
              as: 'c',
              cond: { $eq: ['$$c.status', 'removed'] },
            },
          },
          crops: {
            $filter: {
              input: '$crops',
              as: 'c',
              cond: { $in: ['$$c.status', ['active', 'pending']] },
            },
          },
        },
      },
      {
        $project: {
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
          tasks: 0,
        },
      },
    ]);

    if (!garden[0]) return null;

    const gardenData = garden[0];

    this.log.info(`Garden data after aggregation: ${JSON.stringify(gardenData)}`);
    this.log.info(`Crops in gardenData: ${JSON.stringify(gardenData.crops)}`);

    this.log.info(`Garden location data: ${JSON.stringify(gardenData.location)}`);

    // Fetch or get cached weather data
    const weatherData = await this._getOrCreateDailyWeather(
      gardenData.location.city,
      gardenData.location.country,
      gardenData.location.state
    );

    // Add weather data to the garden object
    if (weatherData) {
      gardenData.weather = weatherData.data;
    }

    return gardenData;
  }

  public async getActiveCrops(
    userId: string
  ): Promise<Pick<IGardenCrop, '_id' | 'cropName' | 'image'>[]> {
    const uId = new Types.ObjectId(userId);
    const activeCrops = await GardenCrop.find({
      userId: uId,
      status: 'active',
    })
      .select('_id cropName image')
      .populate({
        path: 'image',
        select: 'url',
      });

    return activeCrops;
  }

  public async getGardenCropDetails({ uId, cropId }: { uId: string; cropId: string }): Promise<any> {
    const [userId, gardenCropId] = [uId, cropId].map(id => new Types.ObjectId(id));

    const cropDetails = await GardenCrop.aggregate([
      { $match: { _id: gardenCropId, userId } },
      {
        $lookup: {
          from: 'plantingguides',
          localField: 'plantingGuide',
          foreignField: '_id',
          as: 'plantingGuide',
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: '_id',
          foreignField: 'cropId',
          as: 'tasks',
        },
      },
      {
        $lookup: {
          from: 'images',
          localField: 'image',
          foreignField: '_id',
          as: 'image',
          pipeline: [{ $project: { _id: 1, url: 1, index: 1 } }],
        },
      },
      {
        $addFields: {
          image: { $arrayElemAt: ['$image', 0] },
          plantingGuide: { $arrayElemAt: ['$plantingGuide', 0] },
        },
      },
      {
        $project: {
          'plantingGuide.gardenId': 0,
          'plantingGuide.cropId': 0,
          'plantingGuide.createdAt': 0,
          'plantingGuide.updatedAt': 0,
          'plantingGuide.__v': 0,
        },
      },
    ]);

    if (!cropDetails[0]) {
      throw new BadRequestError('Crop not found in your garden');
    }

    return cropDetails[0];
  }

  public async completePlantingStep({
    uId,
    gardenCropId,
    stepId,
  }: { uId: string; gardenCropId: string; stepId: string }): Promise<{
    plantingGuide: IPlantingGuide;
    gardenCropStatus: string;
  }> {
    const userId = new Types.ObjectId(uId);
    const gCropId = new Types.ObjectId(gardenCropId);

    const gardenCrop = await GardenCrop.findOne({ _id: gCropId, userId });
    if (!gardenCrop) {
      throw new BadRequestError('Garden crop not found or does not belong to user');
    }

    const plantingGuide = await PlantingGuideModel.findById(gardenCrop.plantingGuide);
    if (!plantingGuide) {
      throw new BadRequestError('Planting guide not found');
    }

    // Find the step to mark as completed
    const stepIndex = plantingGuide.plantingSteps.findIndex(step => step._id?.toString() === stepId);
    if (stepIndex === -1) {
      throw new BadRequestError('Planting step not found');
    }

    // Ensure current step is not decremented and only the current or next incomplete step can be completed
    const firstIncompleteStepIndex = plantingGuide.plantingSteps.findIndex(step => !step.completed);

    if (stepIndex !== firstIncompleteStepIndex) {
      throw new BadRequestError('Only the current or next incomplete step can be completed');
    }

    // Mark the step as completed
    plantingGuide.plantingSteps[stepIndex].completed = true;
    await plantingGuide.save();

    // Check if all steps are completed
    const allStepsCompleted = plantingGuide.plantingSteps.every(step => step.completed);
    let gardenCropStatus = gardenCrop.status;

    if (allStepsCompleted) {
      gardenCrop.status = 'active';
      gardenCrop.plantedDate = new Date();
      await gardenCrop.save();
      gardenCropStatus = 'active';
    }

    return {
      plantingGuide: plantingGuide.toObject(),
      gardenCropStatus,
    };
  }
}