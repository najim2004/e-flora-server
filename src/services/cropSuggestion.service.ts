import { Types, startSession } from 'mongoose';
import { CropDetails } from '../models/cropDetails.model';
import { CropSuggestionHistory } from '../models/cropSuggestionHistory.model';
import { Crop } from '../models/crop.model';
import { CropSuggestionInput, CropName } from '../types/cropSuggestion.types';
import { WeatherService, WeatherAverages } from '../utils/weather.utils';
import Logger from '../utils/logger';
import GeminiUtils from '../utils/gemini.utils';
import { CropSuggestionPrompts } from '../prompts/cropSuggestion.prompts';
import { SocketServer } from '../socket.server';
import { CropSuggestionSocketHandler } from '../socket/cropSuggestion.socket';
import { ICropSuggestionHistory } from '../interfaces/cropSuggestionHistory.interface';
import { ICropDetails } from '../interfaces/cropDetails.interface';
import { ICrop } from '../interfaces/crop.interface';
import { Image } from '../models/image.model';
import { PexelsUtils } from '../utils/pexels.utils';
import { IImage } from '../interfaces/image.interface';

export class CropSuggestionService {
  private log: Logger;
  private gemini = new GeminiUtils();
  private prompt = new CropSuggestionPrompts();
  private socket: SocketServer;

  constructor() {
    this.socket = SocketServer.getInstance();
    this.log = Logger.getInstance('CropSuggestion');
  }

  public async generateCropSuggestion(input: CropSuggestionInput, userId: string): Promise<void> {
    this.emitProgress(userId, 'initiated', 10, 'Initializing crop suggestion process');
    try {
      const weather = await this.fetchWeather(input.location, userId);
      const cropNames = await this.generateCropNames(input, weather);
      const { found, notFound } = await this.lookup(cropNames);

      const newCrops = notFound.length ? await this.saveNewCropsBatch(notFound, userId) : [];
      const allCrops = [...found, ...newCrops];
      if (!allCrops) throw new Error('failed to generate and save new crops or plants');

      const history = await this.saveHistory(input, userId, allCrops, weather);
      this.emitDone(userId, history._id.toString());

      if (newCrops.length) {
        await this.generateDetails(newCrops, userId);
      }
    } catch (e) {
      this.log.error(`User ${userId}: ${(e as Error).message}`);
      this.emitProgress(userId, 'failed', 0, 'Failed to generate crop suggestions');
      this.socketHndlr().emitFailed(userId, 'Generation failed. Please try again.');
    }
  }

  // --- Histories ---
  public async getOneHistory(id: string): Promise<ICropSuggestionHistory[]> {
    return CropSuggestionHistory.findById(id)
      .select('-createdAt -updatedAt -__v')
      .populate({
        path: 'crops',
        select: '-__v -createdAt -updatedAt',
        populate: { path: 'image' },
      });
  }

  public async getHistories(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<ICropSuggestionHistory[]> {
    return CropSuggestionHistory.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id createdAt crops')
      .populate({ path: 'crops', select: 'name', options: { limit: 5 } });
  }

  public async getCropDetails(slug: string): Promise<ICropDetails | null> {
    return CropDetails.findOne({ slug })
      .select('-__v -createdAt -updatedAt')
      .catch(e => {
        this.log.error(`getCropDetails failed: ${(e as Error).message}`);
        return null;
      });
  }

  // --- Weather ---
  private async fetchWeather(
    loc: CropSuggestionInput['location'],
    uid: string
  ): Promise<WeatherAverages> {
    this.emitProgress(uid, 'analyzing', 25, 'Analyzing weather conditions');
    const weather = await new WeatherService(loc.latitude, loc.longitude).getWeatherAverages(16);
    if (!weather) {
      this.emitProgress(uid, 'failed', 0, 'Weather data unavailable');
      throw new Error('Weather data not available');
    }
    this.emitProgress(uid, 'analyzing', 40, 'Weather analysis completed');
    return weather;
  }

  // --- Crop Names ---
  private async generateCropNames(
    input: CropSuggestionInput,
    weather: WeatherAverages
  ): Promise<CropName[]> {
    const prompt = this.prompt.getCropNamesPrompt({ ...input, weatherAverages: weather });
    const res = await this.gemini.generateResponse(prompt);
    return this.parseGeminiJSON<CropName[]>(res, 'cropNames') ?? [];
  }

  private async lookup(crops: CropName[]): Promise<{ found: ICrop[]; notFound: CropName[] }> {
    const regex = crops.map(c => new RegExp(`^${c.scientificName}$`, 'i'));
    const found = await Crop.find({ scientificName: { $in: regex } });
    const foundSet = new Set(found.map(c => c.scientificName.toLowerCase()));
    const notFound = crops.filter(c => !foundSet.has(c.scientificName.toLowerCase()));
    return { found, notFound };
  }

  // --- saveNewCropsBatch with progress ---
  private async saveNewCropsBatch(cropNames: CropName[], uid: string): Promise<ICrop[]> {
    const session = await startSession();
    session.startTransaction();
    const crops: ICrop[] = [];
    try {
      const batches = [];
      for (let i = 0; i < cropNames.length; i += 6) {
        batches.push(cropNames.slice(i, i + 6));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const progress = Math.min(40 + ((i + 1) / batches.length) * 50, 90);
        this.emitProgress(
          uid,
          'generatingData',
          progress,
          `Processing crop data (${i + 1}/${batches.length})`
        );

        let res: (Omit<ICrop, '_id'> | null)[] = [];
        try {
          const prompt = this.prompt.getCropEnrichmentPrompt(batch);
          const raw = await this.gemini.generateResponse(prompt);
          res = this.parseGeminiJSON<Omit<ICrop, '_id'>[]>(raw, 'cropBatch') ?? [];
        } catch (e) {
          this.log.warn(`Batch generation failed: ${(e as Error).message}`);
        }

        for (const data of res) {
          if (!data?.name || !data?.scientificName) continue;
          const image = (await Image.findOne({
            $or: [{ index: data.scientificName }, { index: data.name }, { index: 'default_image' }],
          }).select('_id index url')) as IImage;
          let newImage: { _id: Types.ObjectId } | null = null;
          if (
            image?.index?.toLowerCase()?.includes('default_image') ||
            image.url?.toLocaleLowerCase().includes('/placeholder') ||
            !image
          ) {
            try {
              const pexelsRes = await new PexelsUtils().fetchImageByName(data.name);

              if (pexelsRes) {
                const saved = await Image.create({
                  url: pexelsRes?.url,
                  index: pexelsRes?.index,
                });
                if (saved) newImage = { _id: saved?._id };
              }
            } catch (error) {
              console.log('[saveNewCropsBatch line 172]: ', error);
            }
          }
          const [created] = await Crop.create(
            [
              {
                ...data,
                image: newImage?._id ? newImage._id : image?._id,
                details: { status: 'pending' },
              },
            ],
            {
              session,
            }
          );
          crops.push(created);
        }

        await new Promise(r => setTimeout(r, 2000)); // delay for API rate limit
      }

      await session.commitTransaction();
      this.emitProgress(uid, 'savingToDB', 95, 'Finalizing crop suggestions');
    } catch (e) {
      await session.abortTransaction();
      this.log.error(`Transaction failed: ${(e as Error).message}`);
      this.emitProgress(uid, 'failed', 0, 'Failed to process crop data');
    } finally {
      session.endSession();
    }

    return crops;
  }

  // --- Crop Details ---
  private async generateDetails(crops: ICrop[], uid: string): Promise<void> {
    for (const crop of crops) {
      try {
        const exists = await CropDetails.findOne({
          $or: [{ scientificName: crop.scientificName }, { name: crop.name }],
        }).select('slug scientificName');

        if (exists) {
          await Crop.findByIdAndUpdate(crop._id, {
            details: {
              status: 'success',
              slug: exists.slug,
              detailsId: exists._id,
            },
          });
          this.emitCropDetail(uid, 'success', crop.details._id, exists.slug);
        } else {
          const raw = await this.gemini.generateResponse(
            this.prompt.getCropDetailsPrompt(crop.name, crop.scientificName)
          );
          const res = this.parseGeminiJSON<ICropDetails>(raw, 'detail');
          if (!res?.name) throw new Error('Invalid crop detail');

          const saved = await CropDetails.create({ ...res, cropId: crop._id });
          await Crop.findByIdAndUpdate(crop._id, {
            details: {
              status: 'success',
              slug: saved.slug,
              detailsId: saved._id,
            },
          });
          this.emitCropDetail(uid, 'success', crop.details._id, saved.slug);
        }
      } catch (e) {
        await Crop.findByIdAndUpdate(crop._id, { 'details.status': 'failed' });
        this.log.warn(`Failed detail "${crop.scientificName}": ${(e as Error).message}`);
        this.emitCropDetail(uid, 'failed', crop.details._id);
      }

      // wait 1.5–2 seconds before next detail 
      await new Promise(r => setTimeout(r, 1500 + Math.floor(Math.random() * 500)));
    }
  }

  // --- History ---
  private async saveHistory(
    input: Omit<CropSuggestionInput, 'mode'>,
    uid: string,
    crops: ICrop[],
    weather: WeatherAverages
  ): Promise<ICropSuggestionHistory> {
    const [hist] = await CropSuggestionHistory.create([
      {
        userId: new Types.ObjectId(uid),
        gardenId: input.gardenId,
        input: { ...input },
        weather,
        crops: crops.map(c => c._id), // শুধুমাত্র ObjectId array
      },
    ]);
    return hist.toObject();
  }

  // --- Utility ---
  private parseGeminiJSON<T>(raw: unknown, label = ''): T | null {
    try {
      if (typeof raw !== 'string') return raw as T;
      let str = raw.trim();
      if (str.startsWith('```'))
        str = str
          .replace(/^```json?\n?/, '')
          .replace(/```$/, '')
          .trim();
      return JSON.parse(str) as T;
    } catch (e) {
      this.log.warn(`${label} JSON parse failed: ${(e as Error).message}`);
      return null;
    }
  }

  private emitProgress(
    uid: string,
    status: 'initiated' | 'analyzing' | 'generatingData' | 'savingToDB' | 'completed' | 'failed',
    progress: number,
    msg: string
  ): void {
    this.socketHndlr().emitProgress({ userId: uid, status, progress, message: msg });
  }

  private emitDone(uid: string, histId: string): void {
    this.socketHndlr().emitCompleted(uid, { resultId: histId });
  }

  private emitCropDetail(
    uid: string,
    status: 'success' | 'failed',
    detId: string | Types.ObjectId,
    slug?: string
  ): void {
    this.socketHndlr().emitCropDetails(uid, { status, slug, detailsId: detId.toString() });
  }

  private socketHndlr(): CropSuggestionSocketHandler {
    return this.socket.cropSuggestion();
  }
}
