import { Types, startSession } from 'mongoose';
import { CropDetails } from '../models/cropDetails.model';
import { CropSuggestionHistory } from '../models/cropSuggestionHistory.model';
import { Crop } from '../models/crop.model';
import { Image } from '../models/image.model';
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

type MinimalCrop = CropName & { _id: Types.ObjectId };

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
    this.emitProgress(userId, 'initiated', 10, 'Starting...');
    try {
      const weather = await this.fetchWeather(input.location, userId);
      const cropNames = await this.generateCropNames(input, weather);
      const { found, notFound } = await this.lookup(cropNames);
      const newCrops = notFound.length ? await this.saveNewCrops(notFound) : [];
      const allCrops = [...found, ...newCrops];
      const history = await this.saveHistory(input, userId, allCrops, weather);
      this.emitDone(userId, history._id.toString());
      if (newCrops.length)
        this.generateDetails(
          newCrops.map(c => ({ ...c, _id: c._id })),
          userId
        );
    } catch (e) {
      this.log.error(`User ${userId}: ${(e as Error).message}`);
      this.socketHndlr().emitFailed(userId, 'Generation failed. Try again.');
    }
  }

  public async getOneHistory(id: string): Promise<ICropSuggestionHistory[]> {
    return await CropSuggestionHistory.findById(id)
      .select('-createdAt -updatedAt -__v')
      .populate({
        path: 'crops',
        select: '-__v -createdAt -updatedAt',
        populate: {
          path: 'image',
        },
      });
  }
  public async getHistories(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<ICropSuggestionHistory[]> {
    return await CropSuggestionHistory.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id createdAt crops')
      .populate({
        path: 'crops',
        select: 'name',
        options: { limit: 5 },
      });
  }

  public async getCropDetails(slug: string): Promise<ICropDetails | null> {
    return await CropDetails.findOne({ slug })
      .select('-__v -createdAt -updatedAt')
      .catch(e => {
        this.log.error(`getCropDetails failed: ${(e as Error).message}`);
        return null;
      });
  }

  private async fetchWeather(
    loc: CropSuggestionInput['location'],
    uid: string
  ): Promise<WeatherAverages> {
    this.emitProgress(uid, 'analyzing', 30, 'Fetching weather...');
    const weather = await new WeatherService(loc.latitude, loc.longitude).getWeatherAverages(16);
    this.emitProgress(uid, 'analyzing', 40, 'Weather fetched.');
    return weather;
  }

  private async generateCropNames(
    input: CropSuggestionInput,
    weather: WeatherAverages
  ): Promise<CropName[]> {
    if (!input.image) return [];
    const prompt = this.prompt.getCropNamesPrompt({ ...input, weatherAverages: weather });
    const res = await this.gemini.generateResponseWithImage(prompt, {
      path: input.image.path,
      mimeType: input.image.mimetype,
    });
    return this.parseGeminiJSON<CropName[]>(res, 'cropNames') ?? [];
  }

  private async lookup(crops: CropName[]): Promise<{ found: ICrop[]; notFound: CropName[] }> {
    const regex = crops.map(c => new RegExp(`^${c.scientificName}$`, 'i'));
    const found = await Crop.find({ scientificName: { $in: regex } });
    const foundSet = new Set(found.map(c => c.scientificName.toLowerCase()));
    const notFound = crops.filter(c => !foundSet.has(c.scientificName.toLowerCase()));
    return { found, notFound };
  }

  private async saveNewCrops(cropNames: CropName[]): Promise<ICrop[]> {
    const session = await startSession();
    session.startTransaction();
    const crops: ICrop[] = [];
    try {
      for (const { name, scientificName } of cropNames) {
        try {
          const prompt = this.prompt.getCropEnrichmentPrompt(name, scientificName);
          const res = this.parseGeminiJSON<Omit<ICrop, '_id'>>(
            await this.gemini.generateResponse(prompt),
            'crop'
          );
          if (!res?.name || !res?.scientificName) throw new Error('Invalid crop');
          const img = await Image.findOne({ index: res.scientificName }).session(session);
          const [created] = await Crop.create(
            [{ ...res, imageId: img?._id, details: { status: 'pending' } }],
            { session }
          );
          crops.push(created);
        } catch (e) {
          this.log.warn(`Skip crop "${scientificName}": ${(e as Error).message}`);
        }
      }
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      this.log.error(`Transaction failed: ${(e as Error).message}`);
    } finally {
      session.endSession();
    }
    return crops;
  }

  private async generateDetails(crops: MinimalCrop[], uid: string): Promise<void> {
    for (const crop of crops) {
      try {
        const exists = await CropDetails.findOne({
          $or: [{ scientificName: crop.scientificName }, { name: crop.name }],
        }).select('slug scientificName');
        if (exists) return this.emitCropDetail(uid, 'success', exists.scientificName, exists.slug);

        const raw = await this.gemini.generateResponse(
          this.prompt.getCropDetailsPrompt(crop.name, crop.scientificName)
        );
        const res = this.parseGeminiJSON<ICropDetails>(raw, 'detail');
        if (!res?.name) throw new Error('Invalid crop detail');
        const saved = await CropDetails.create({ ...res, cropId: crop._id });
        this.emitCropDetail(uid, 'success', saved.scientificName, saved.slug);
      } catch (e) {
        this.log.warn(`Failed detail "${crop.scientificName}": ${(e as Error).message}`);
        this.emitCropDetail(uid, 'failed', crop.scientificName);
      }
    }
  }

  private async saveHistory(
    input: Omit<CropSuggestionInput, 'image' | 'mode'>,
    uid: string,
    crops: ICrop[],
    weather: WeatherAverages
  ): Promise<ICropSuggestionHistory> {
    const [hist] = await CropSuggestionHistory.create([
      {
        userId: new Types.ObjectId(uid),
        gardenId: input.gardenId,
        input: {
          location: input.location,
          purpose: input.purpose,
          sunlight: input.sunlight,
          soilType: input.soilType,
          area: input.area,
          waterSource: input.waterSource,
          plantType: input.plantType,
        },
        weather,
        crops: crops.map(c => ({ cropId: c._id, cropDetails: { status: 'pending' } })),
      },
    ]);
    return hist.toObject();
  }

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
    sci: string,
    slug?: string
  ): void {
    this.socketHndlr().emitCropDetails(uid, { status, slug, scientificName: sci });
  }
  private socketHndlr(): CropSuggestionSocketHandler {
    return this.socket.cropSuggestion();
  }
}
