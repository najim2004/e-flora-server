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
      await GardenCrop.create({
        userId,
        garden: gId,
        cropId: crop._id,
        cropName: crop.name,
        scientificName: crop.scientificName,
        plantingGuide: guideId,
        image: crop.image,
        description: crop.description,
      });

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

  public async getMyGarden({ uId, gardenId }: { uId: string; gardenId: string }): Promise<
    | (Omit<IGarden, 'crops' | 'tasks' | 'createdAt' | 'updatedAt'> & {
        crops: (Pick<
          IGardenCrop,
          '_id' | 'cropName' | 'scientificName' | 'healthScore' | 'status'
        > & { image: Pick<IImage, '_id' | 'url' | 'index'>; nextTask: string })[];
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
                plantingDate: 1,
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

    return garden[0] ?? null;
  }
}
